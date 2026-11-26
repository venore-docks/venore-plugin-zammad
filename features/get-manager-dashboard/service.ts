import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { UNASSIGNED_OWNER_ID, isUnassigned } from "../../shared/access-rules";
import { flowStepOf, type FlowStep } from "../../shared/flow";
import { loadAgentOptions } from "../../shared/own-ticket";
import { bucketOf, countBuckets, defaultBucket, type QueueBucket } from "../../shared/queue-buckets";
import { describeState } from "../../shared/ticket-state";
import { assigneesFor, teamFor } from "../../shared/directory";
import { isUrgentPriority, pickLeastLoaded, rankLoads, sectorChips, sortQueue, summarizeManager, ageMs, type KpiTicket } from "../../shared/manager-stats";
import { getPeople } from "../../shared/people";
import type { Requester } from "../../shared/requester";
import { priorityLabel } from "../../shared/ticket-options";
import { searchOpenTicketsByOwner, searchTicketsByOwner } from "../../shared/ticket-search";
import { loadTicketTags } from "../../shared/ticket-tags";
import { isCustomerWaiting } from "../../shared/ticket-state";
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

// Mesmo limite do get-team-overview: uma busca por agente, em paralelo.
const MAX_MEMBERS = 40;
const QUEUE_TOP = 5;
const LOADS_TTL_MS = 60 * 1000;
// Aba Finalizado: só os mais recentes (é consulta; o resto continua no histórico de cada pessoa).
const FINISHED_LIMIT = 50;

type Snapshot = {
  now: number;
  members: { id: number; name: string }[];
  // Sem responsável: abertos (a fila) e encerrados (Não autorizado, Finalizado). UMA busca no Zammad.
  queue: ZammadExpandedTicket[];
  unassignedClosed: ZammadExpandedTicket[];
  // Os de cada agente (mesma ordem de `members`): só abertos, ou também encerrados com `includeClosed`.
  perMember: ZammadExpandedTicket[][];
};

const isClosed = (ticket: ZammadExpandedTicket) => describeState(ticket.state ?? "").closed;

// A fila e os chamados de cada agente da equipe: 1 + N buscas no Zammad, todas em paralelo. `includeClosed`: os de
// cada agente vêm também encerrados (os 100 mais recentes de cada um) — só para a aba Finalizado.
async function loadSnapshot(requester: Requester, options: { includeClosed?: boolean } = {}): Promise<OperationResult<Snapshot>> {
  const team = await teamFor(requester);
  const members = team.members.slice(0, MAX_MEMBERS).map((member) => ({ id: member.id, name: member.name }));
  const byMember = options.includeClosed ? searchTicketsByOwner : searchOpenTicketsByOwner;
  const [unassigned, ...perMember] = await Promise.all([
    searchTicketsByOwner(requester, UNASSIGNED_OWNER_ID),
    ...members.map((member) => byMember(requester, member.id)),
  ]);
  if (!unassigned.success) return unassigned;
  return {
    success: true,
    data: {
      now: Date.now(),
      members,
      queue: unassigned.data.filter((ticket) => !isClosed(ticket)),
      unassignedClosed: unassigned.data.filter(isClosed),
      perMember: perMember.map((found) => (found.success ? found.data : [])),
    },
  };
}

function toKpiTicket(ticket: ZammadExpandedTicket): KpiTicket {
  return { ownerId: ticket.owner_id, priority: ticket.priority ?? "", customerWaiting: isCustomerWaiting(ticket), createdAt: ticket.created_at };
}

function loadsOf(snapshot: Snapshot): Map<number, { open: number; waiting: number }> {
  const loads = new Map<number, { open: number; waiting: number }>();
  snapshot.members.forEach((member, index) => {
    // Carga = só os abertos (com includeClosed, a lista traz também os encerrados).
    const tickets = (snapshot.perMember[index] ?? []).filter((ticket) => !isClosed(ticket));
    loads.set(member.id, { open: tickets.length, waiting: tickets.filter((ticket) => isCustomerWaiting(ticket)).length });
  });
  return loads;
}

// Linha "crua": tudo que vem da busca, sem solicitante nem tags (esses custam uma leitura por chamado — ver
// completeRows). null = fora da fila (estado genérico encerrado).
function toRow(ticket: ZammadExpandedTicket, now: number, ownerNames: Map<number, string>): QueueRow | null {
  const state = describeState(ticket.state ?? "");
  const ownerId = isUnassigned(ticket.owner_id) ? null : ticket.owner_id;
  const bucket = bucketOf(state.step, ownerId !== null, state.closed);
  if (!bucket) return null;
  return {
    id: ticket.id,
    number: String(ticket.number),
    title: ticket.title,
    group: ticket.group,
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
  const { now, members, queue, perMember } = snapshot.data;

  const loads = loadsOf(snapshot.data);
  const assigned = perMember.flat();
  const kpis = summarizeManager(queue.map(toKpiTicket), assigned.map(toKpiTicket), now);
  const agents = rankLoads(members.map((member) => ({ id: member.id, name: member.name, ...(loads.get(member.id) ?? { open: 0, waiting: 0 }) })));

  // Os mais antigos da fila: só deles buscamos solicitante, tags e opções de alocação.
  const oldest = [...queue].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, QUEUE_TOP);
  const bare = oldest.flatMap((ticket) => toRow(ticket, now, new Map()) ?? []);
  const [queueTop, allocation] = await Promise.all([
    completeRows(requester, bare, new Map(oldest.map((ticket) => [ticket.id, ticket]))),
    allocationFor(bare, loads),
  ]);
  return { success: true, data: { kpis, agents, queueTop, allocation, flowStateIds: flowStateIdsOf(options) } };
}

// A fila do gestor por etapa, com TODOS os estados (uma aba por estado). Para ser rápida:
//   - as contagens das abas vêm das buscas (1 + N, em paralelo), sem nenhuma leitura extra;
//   - solicitante e tags (uma leitura por chamado) só para as linhas da aba aberta;
//   - os encerrados de cada agente só são buscados na aba Finalizado (fora dela, a contagem dessa aba é
//     desconhecida: `uncounted`).
export async function getQueueBoard(requester: Requester, input: GetQueueBoardInput = {}): Promise<GetQueueBoardResult> {
  const includeClosed = input.bucket === "finalizado";
  const [snapshot, options] = await Promise.all([loadSnapshot(requester, { includeClosed }), loadAgentOptions()]);
  if (!snapshot.success) return snapshot;
  const { now, queue, unassignedClosed, perMember, members } = snapshot.data;

  // Encerrados sem responsável só entram se forem do fluxo (Não autorizado espera o solicitante; Finalizado).
  const flowClosed = unassignedClosed.filter((ticket) => flowStepOf(ticket.state) !== null);
  const byId = new Map<number, ZammadExpandedTicket>();
  for (const ticket of [...queue, ...flowClosed, ...perMember.flat()]) byId.set(ticket.id, ticket);
  const ownerNames = new Map(members.map((member) => [member.id, member.name]));
  const all = [...byId.values()].flatMap((ticket) => toRow(ticket, now, ownerNames) ?? []);

  const counts = countBuckets(all);
  const uncounted: QueueBucket[] = includeClosed ? [] : ["finalizado"];
  const bucket = input.bucket ?? defaultBucket(counts);

  let inBucket = sortQueue(
    all.filter((row) => row.bucket === bucket),
    "idade",
  );
  if (bucket === "finalizado") {
    const updated = (row: QueueRow) => byId.get(row.id)?.updated_at ?? "";
    inBucket = [...inBucket].sort((a, b) => updated(b).localeCompare(updated(a))).slice(0, FINISHED_LIMIT);
  }

  const [items, allocation] = await Promise.all([
    completeRows(requester, inBucket, byId, bucket !== "finalizado"),
    allocationFor(inBucket, loadsOf(snapshot.data)),
  ]);
  return {
    success: true,
    data: { bucket, items, sectors: sectorChips(items), allocation, counts, uncounted, flowStateIds: flowStateIdsOf(options) },
  };
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

// Carga por agente com cache curto (60 s) por gestor: serve só à dica "menos carregado" do detalhe do chamado,
// que não precisa ser exata e não pode custar N buscas a cada abertura de chamado.
const loadsCache = new Map<number, { at: number; loads: TeamLoads }>();

export async function getTeamLoads(requester: Requester): Promise<GetTeamLoadsResult> {
  const cached = loadsCache.get(requester.zammadUser.id);
  if (cached && Date.now() - cached.at < LOADS_TTL_MS) return { success: true, data: cached.loads };
  const snapshot = await loadSnapshot(requester);
  if (!snapshot.success) return snapshot;
  const loads: TeamLoads = {};
  for (const [id, load] of loadsOf(snapshot.data)) loads[id] = load;
  loadsCache.set(requester.zammadUser.id, { at: Date.now(), loads });
  return { success: true, data: loads };
}
