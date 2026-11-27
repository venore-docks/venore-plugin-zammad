import type { OperationResult } from "@venore/plugin-sdk";
import { formatGroupName } from "../../shared/format";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { isUnassigned } from "../../shared/access-rules";
import { DEADLINE_FIELD } from "../../shared/deadline";
import { ESTIMATE_FIELD, estimateLabel, estimateOptions, type EstimateOption } from "../../shared/estimate";
import { loadSchema } from "../../shared/schema";
import { flowStepOf, type FlowStep } from "../../shared/flow";
import { loadAgentOptions } from "../../shared/own-ticket";
import { OPEN_STAGES, OPEN_TAB, bucketOf, countBuckets, type QueueBucket } from "../../shared/queue-buckets";
import { describeState } from "../../shared/ticket-state";
import { assigneesFor } from "../../shared/directory";
import { loadManagerSnapshot } from "../../shared/manager-snapshot";
import { isUrgentPriority, pickLeastLoaded, rankLoads, sectorChips, sortQueue, summarizeManager, ageMs, type KpiTicket, type SectorChip } from "../../shared/manager-stats";
import { getPeople } from "../../shared/people";
import type { Requester } from "../../shared/requester";
import { priorityLabel } from "../../shared/ticket-options";
import { loadTicketTags } from "../../shared/ticket-tags";
import { isAwaitingDecision, isAwaitingRequester, isCustomerWaiting, isOpenTicket } from "../../shared/ticket-state";
import type {
  AllocationOptions,
  AssigneeOption,
  GetManagerDashboardResult,
  GetQueueBoardInput,
  GetQueueBoardResult,
  GetTeamLoadsResult,
  QueueRow,
  TeamLoads,
} from "./types";

// Rótulos do tempo previsto (opções do campo do Zammad; schema em cache). Sem o campo, lista vazia.
async function loadEstimateOptions(): Promise<EstimateOption[]> {
  const schema = await loadSchema();
  return (schema.success ? estimateOptions(schema.data.attributes) : null) ?? [];
}

const QUEUE_TOP = 5;
// "Em aberto": linhas por etapa na primeira tela (o resto vem na aba da etapa).
const OVERVIEW_PER_STAGE = 10;
// Aba Finalizado: só os mais recentes (é consulta; o resto continua no histórico de cada pessoa).
const FINISHED_LIMIT = 50;

type Snapshot = {
  now: number;
  members: { id: number; name: string }[];
  // Sem responsável: abertos (a fila) e encerrados (Finalizado).
  queue: ZammadExpandedTicket[];
  unassignedClosed: ZammadExpandedTicket[];
  // Os de cada agente (mesma ordem de `members`): só abertos, ou também encerrados com `includeClosed`.
  perMember: ZammadExpandedTicket[][];
};

const isClosed = (ticket: ZammadExpandedTicket) => !isOpenTicket(ticket);

// A fila e os chamados de cada agente da equipe, vindos da leitura compartilhada (shared/manager-snapshot.ts: em
// memória, 1 + N buscas só quando o cache vence). `includeClosed`: os de cada agente vêm também encerrados — só para a
// aba Finalizado.
async function loadSnapshot(requester: Requester, options: { includeClosed?: boolean } = {}): Promise<OperationResult<Snapshot>> {
  const raw = await loadManagerSnapshot(requester, options);
  if (!raw.success) return raw;
  return {
    success: true,
    data: {
      now: Date.now(),
      members: raw.data.members,
      queue: raw.data.unassigned.filter((ticket) => !isClosed(ticket)),
      unassignedClosed: raw.data.unassigned.filter(isClosed),
      perMember: raw.data.perMember,
    },
  };
}

function toKpiTicket(ticket: ZammadExpandedTicket): KpiTicket {
  return { id: ticket.id, ownerId: ticket.owner_id, priority: ticket.priority ?? "", customerWaiting: isCustomerWaiting(ticket), createdAt: ticket.created_at };
}

function loadsOf(snapshot: Snapshot): Map<number, { open: number; waiting: number; awaitingRequester: number }> {
  const loads = new Map<number, { open: number; waiting: number; awaitingRequester: number }>();
  snapshot.members.forEach((member, index) => {
    // Carga = só os abertos (com includeClosed, a lista traz também os encerrados).
    const tickets = (snapshot.perMember[index] ?? []).filter((ticket) => !isClosed(ticket));
    loads.set(member.id, {
      open: tickets.length,
      waiting: tickets.filter((ticket) => isCustomerWaiting(ticket)).length,
      awaitingRequester: tickets.filter((ticket) => isAwaitingRequester(ticket)).length,
    });
  });
  return loads;
}

// Linha "crua": tudo que vem da busca, sem solicitante nem tags (esses custam uma leitura por chamado — ver
// completeRows). null = fora da fila (estado genérico encerrado).
function toRow(ticket: ZammadExpandedTicket, now: number, ownerNames: Map<number, string>, estimates: EstimateOption[] = [], strict = false): QueueRow | null {
  const state = describeState(ticket.state ?? "");
  const ownerId = isUnassigned(ticket.owner_id) ? null : ticket.owner_id;
  const bucket = bucketOf(state.step, ownerId !== null, state.closed, strict);
  if (!bucket) return null;
  const raw = ticket as unknown as Record<string, unknown>;
  const deadlineValue = raw[DEADLINE_FIELD];
  const deadlineInstant = typeof deadlineValue === "string" && deadlineValue ? new Date(deadlineValue) : null;
  return {
    deadline: deadlineInstant && !Number.isNaN(deadlineInstant.getTime()) ? deadlineInstant.toISOString() : null,
    estimateLabel: estimateLabel(estimates, raw[ESTIMATE_FIELD]),
    id: ticket.id,
    number: String(ticket.number),
    title: ticket.title,
    group: formatGroupName(ticket.group),
    groupId: ticket.group_id,
    priorityId: ticket.priority_id,
    priorityLabel: priorityLabel(ticket.priority ?? ""),
    urgent: isUrgentPriority(ticket.priority),
    requesterName: null,
    ageMs: ageMs(ticket.created_at, now),
    step: state.step,
    stateLabel: state.label,
    stateColor: state.color,
    bucket,
    ownerId,
    ownerName: ownerId === null ? null : (ownerNames.get(ownerId) ?? null),
    tags: [],
  };
}

// Solicitante e tags SÓ das linhas que vão para a tela: a busca do Zammad não traz nenhum dos dois, e cada um é
// uma leitura por pessoa/chamado (com cache). `withTags: false` pula as tags (aba Finalizado: não ajudam a decidir).
async function completeRows(requester: Requester, rows: QueueRow[], tickets: Map<number, ZammadExpandedTicket>, withTags = true): Promise<QueueRow[]> {
  const source = rows.flatMap((row) => {
    const ticket = tickets.get(row.id);
    return ticket ? [ticket] : [];
  });
  const [people, tags] = await Promise.all([
    getPeople(source.map((ticket) => ticket.customer_id)),
    withTags ? loadTicketTags(requester, source) : Promise.resolve(new Map<number, string[]>()),
  ]);
  return rows.map((row) => {
    const customerId = tickets.get(row.id)?.customer_id;
    return {
      ...row,
      requesterName: customerId === undefined ? null : (people.get(customerId)?.name ?? null),
      tags: tags.get(row.id) ?? [],
    };
  });
}

// Quem recebe chamados de cada setor presente nas linhas (um cálculo por setor distinto, sem N+1: o diretório
// fica em cache) e a sugestão = o menos carregado.
async function allocationFor(rows: QueueRow[], loads: Map<number, { open: number; waiting: number }>): Promise<AllocationOptions> {
  const groupIds = [...new Set(rows.map((row) => row.groupId))];
  const lists = await Promise.all(groupIds.map((groupId) => assigneesFor(groupId)));
  const byGroup: Record<number, AssigneeOption[]> = {};
  const suggestedByGroup: Record<number, number | null> = {};
  groupIds.forEach((groupId, index) => {
    const options: AssigneeOption[] = lists[index].map((person) => {
      const load = loads.get(person.id);
      return { id: person.id, name: person.name, open: load?.open ?? null, waiting: load?.waiting ?? null };
    });
    byGroup[groupId] = options;
    const known = options.filter((option): option is AssigneeOption & { open: number } => option.open !== null);
    suggestedByGroup[groupId] = pickLeastLoaded(known.map((option) => ({ id: option.id, open: option.open, waiting: option.waiting ?? 0 })))?.id ?? null;
  });
  return { byGroup, suggestedByGroup };
}

export async function getManagerDashboard(requester: Requester): Promise<GetManagerDashboardResult> {
  const [snapshot, options] = await Promise.all([loadSnapshot(requester), loadAgentOptions()]);
  if (!snapshot.success) return snapshot;
  const { now, members, perMember } = snapshot.data;
  const loads = loadsOf(snapshot.data);
  const assigned = perMember.flat().filter(isOpenTicket);
  // "Aguardando decisão" = os mesmos chamados do grupo "Decisão do gestor" da Fila (Novo, Em análise, Autorizado,
  // Reavaliação), COM ou SEM responsável: o mesmo critério da Fila, então os números e o "mais antigo" batem.
  const seen = new Set<number>();
  const decision = [...snapshot.data.queue, ...assigned].filter((ticket) => {
    if (seen.has(ticket.id) || !isAwaitingDecision(ticket)) return false;
    seen.add(ticket.id);
    return true;
  });
  const kpis = summarizeManager(decision.map(toKpiTicket), assigned.map(toKpiTicket), now);
  const agents = rankLoads(members.map((member) => ({ id: member.id, name: member.name, ...(loads.get(member.id) ?? { open: 0, waiting: 0, awaitingRequester: 0 }) })));

  // Os mais antigos aguardando decisão: só deles buscamos solicitante, tags e opções de alocação.
  const oldest = [...decision].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, QUEUE_TOP);
  const estimates = await loadEstimateOptions();
  const bare = oldest.flatMap((ticket) => toRow(ticket, now, new Map(), estimates, hasFlow(options)) ?? []);
  const [queueTop, allocation] = await Promise.all([
    completeRows(requester, bare, new Map(oldest.map((ticket) => [ticket.id, ticket]))),
    allocationFor(bare, loads),
  ]);
  return { success: true, data: { kpis, agents, queueTop, allocation, flowStateIds: flowStateIdsOf(options) } };
}

// A fila do gestor. Duas formas, uma por chamada (`input.bucket`):
//   - "abertos" (a aba inicial): TODOS os chamados abertos, agrupados por etapa na ordem do fluxo. Cada etapa traz
//     as 10 (OVERVIEW_PER_STAGE) primeiras linhas (as demais ficam na aba da etapa, com o total no subtítulo), sem tags;
//   - uma etapa: as linhas dela, com solicitante e tags.
// Para ser rápida:
//   - as contagens vêm das buscas (1 + N, em paralelo), sem nenhuma leitura extra;
//   - solicitante (e tags, nas abas de etapa) só para as linhas que vão para a tela;
//   - os encerrados de cada agente só são buscados na aba Finalizado (fora dela, a contagem dessa aba é
//     desconhecida: `uncounted`).
export async function getQueueBoard(requester: Requester, input: GetQueueBoardInput = {}): Promise<GetQueueBoardResult> {
  const bucket = input.bucket ?? OPEN_TAB;
  const sort = input.sort ?? "idade";
  const includeClosed = bucket === "finalizado";
  const [snapshot, options] = await Promise.all([loadSnapshot(requester, { includeClosed }), loadAgentOptions()]);
  if (!snapshot.success) return snapshot;
  const { now, queue, unassignedClosed, perMember, members } = snapshot.data;

  // Encerrados sem responsável só entram se forem do fluxo (Finalizado).
  const flowClosed = unassignedClosed.filter((ticket) => flowStepOf(ticket.state) !== null);
  const byId = new Map<number, ZammadExpandedTicket>();
  for (const ticket of [...queue, ...flowClosed, ...perMember.flat()]) byId.set(ticket.id, ticket);
  const ownerNames = new Map(members.map((member) => [member.id, member.name]));
  const estimates = await loadEstimateOptions();
  const all = [...byId.values()].flatMap((ticket) => toRow(ticket, now, ownerNames, estimates, hasFlow(options)) ?? []);

  const counts = countBuckets(all);
  const uncounted: QueueBucket[] = includeClosed ? [] : ["finalizado"];
  const loads = loadsOf(snapshot.data);

  let pool: QueueRow[];
  let sectors: SectorChip[];
  let filteredCounts = counts;
  let shown: QueueRow[];
  if (bucket === OPEN_TAB) {
    pool = all.filter((row) => row.bucket !== "finalizado");
    sectors = sectorChips(pool);
    if (input.groupId !== undefined) {
      pool = pool.filter((row) => row.groupId === input.groupId);
      filteredCounts = countBuckets(pool);
    }
    shown = OPEN_STAGES.flatMap((stage) => sortQueue(pool.filter((row) => row.bucket === stage.key), sort).slice(0, OVERVIEW_PER_STAGE));
  } else {
    pool = sortQueue(all.filter((row) => row.bucket === bucket), "idade");
    if (bucket === "finalizado") {
      const updated = (row: QueueRow) => byId.get(row.id)?.updated_at ?? "";
      pool = [...pool].sort((a, b) => updated(b).localeCompare(updated(a))).slice(0, FINISHED_LIMIT);
    }
    sectors = sectorChips(pool);
    shown = pool;
  }

  const withTags = bucket !== OPEN_TAB && bucket !== "finalizado";
  const [items, allocation] = await Promise.all([completeRows(requester, shown, byId, withTags), allocationFor(shown, loads)]);
  return {
    success: true,
    data: { bucket, items, sectors, allocation, counts, filteredCounts, uncounted, flowStateIds: flowStateIdsOf(options) },
  };
}

// O Zammad tem os estados do fluxo da FEM (não é um Zammad genérico).
function hasFlow(options: Awaited<ReturnType<typeof loadAgentOptions>>): boolean {
  return Object.keys(flowStateIdsOf(options)).length > 0;
}

function flowStateIdsOf(options: Awaited<ReturnType<typeof loadAgentOptions>>): Partial<Record<FlowStep, number>> {
  const ids: Partial<Record<FlowStep, number>> = {};
  if (!options.success) return ids;
  for (const state of options.data.states) {
    const step = flowStepOf(state.name);
    if (step) ids[step] = state.id;
  }
  return ids;
}

// Carga por agente, para a dica "menos carregado" do detalhe do chamado. Vem da leitura compartilhada (em cache), então
// não custa N buscas a cada abertura de chamado e acompanha as atribuições (toda escrita descarta o cache).
export async function getTeamLoads(requester: Requester): Promise<GetTeamLoadsResult> {
  const snapshot = await loadSnapshot(requester);
  if (!snapshot.success) return snapshot;
  const loads: TeamLoads = {};
  for (const [id, load] of loadsOf(snapshot.data)) loads[id] = load;
  return { success: true, data: loads };
}
