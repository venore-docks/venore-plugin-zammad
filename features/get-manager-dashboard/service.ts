import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { UNASSIGNED_OWNER_ID, isUnassigned } from "../../shared/access-rules";
import { flowStepOf, type FlowStep } from "../../shared/flow";
import { loadAgentOptions } from "../../shared/own-ticket";
import { bucketOf, countBuckets } from "../../shared/queue-buckets";
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
  GetQueueBoardResult,
  GetTeamLoadsResult,
  QueueRow,
  TeamLoads,
} from "./types";

// Mesmo limite do get-team-overview: uma busca por agente, em paralelo.
const MAX_MEMBERS = 40;
const QUEUE_TOP = 5;
const LOADS_TTL_MS = 60 * 1000;

type Snapshot = {
  now: number;
  members: { id: number; name: string }[];
  queue: ZammadExpandedTicket[];
  // Abertos de cada agente (mesma ordem de `members`).
  perMember: ZammadExpandedTicket[][];
};

// A fila e os chamados de cada agente da equipe: N+1 buscas no Zammad, todas em paralelo. `includeClosed`: os de
// cada agente vêm também encerrados (os 100 mais recentes de cada um) — a fila mostra a aba Finalizado.
async function loadSnapshot(requester: Requester, options: { includeClosed?: boolean } = {}): Promise<OperationResult<Snapshot>> {
  const team = await teamFor(requester);
  const members = team.members.slice(0, MAX_MEMBERS).map((member) => ({ id: member.id, name: member.name }));
  const byMember = options.includeClosed ? searchTicketsByOwner : searchOpenTicketsByOwner;
  const [queue, ...perMember] = await Promise.all([
    searchOpenTicketsByOwner(requester, UNASSIGNED_OWNER_ID),
    ...members.map((member) => byMember(requester, member.id)),
  ]);
  if (!queue.success) return queue;
  return {
    success: true,
    data: { now: Date.now(), members, queue: queue.data, perMember: perMember.map((found) => (found.success ? found.data : [])) },
  };
}

function toKpiTicket(ticket: ZammadExpandedTicket): KpiTicket {
  return { ownerId: ticket.owner_id, priority: ticket.priority ?? "", customerWaiting: isCustomerWaiting(ticket), createdAt: ticket.created_at };
}

function loadsOf(snapshot: Snapshot): Map<number, { open: number; waiting: number }> {
  const loads = new Map<number, { open: number; waiting: number }>();
  snapshot.members.forEach((member, index) => {
    // Carga = só os abertos (com includeClosed, a lista traz também os encerrados).
    const tickets = (snapshot.perMember[index] ?? []).filter((ticket) => !describeState(ticket.state ?? "").closed);
    loads.set(member.id, { open: tickets.length, waiting: tickets.filter((ticket) => isCustomerWaiting(ticket)).length });
  });
  return loads;
}

async function toRows(requester: Requester, tickets: ZammadExpandedTicket[], now: number, ownerNames: Map<number, string> = new Map()): Promise<QueueRow[]> {
  const [people, tags] = await Promise.all([getPeople(tickets.map((ticket) => ticket.customer_id)), loadTicketTags(requester, tickets)]);
  return tickets.flatMap((ticket) => {
    const state = describeState(ticket.state ?? "");
    const ownerId = isUnassigned(ticket.owner_id) ? null : ticket.owner_id;
    const bucket = bucketOf(state.step, ownerId !== null, state.closed);
    if (!bucket) return [];
    return [
      {
        id: ticket.id,
        number: String(ticket.number),
        title: ticket.title,
        group: ticket.group,
        groupId: ticket.group_id,
        priorityId: ticket.priority_id,
        priorityLabel: priorityLabel(ticket.priority ?? ""),
        urgent: isUrgentPriority(ticket.priority),
        requesterName: people.get(ticket.customer_id)?.name ?? null,
        ageMs: ageMs(ticket.created_at, now),
        step: state.step,
        stateLabel: state.label,
        stateColor: state.color,
        bucket,
        ownerId,
        ownerName: ownerId === null ? null : (ownerNames.get(ownerId) ?? null),
        tags: tags.get(ticket.id) ?? [],
      },
    ];
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

  // Os mais antigos da fila: só deles buscamos solicitante e opções de alocação.
  const oldest = [...queue].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, QUEUE_TOP);
  const queueTop = await toRows(requester, oldest, now);
  const allocation = await allocationFor(queueTop, loads);
  return { success: true, data: { kpis, agents, queueTop, allocation, flowStateIds: flowStateIdsOf(options) } };
}

// A fila do gestor por etapa, com TODOS os estados: sem responsável (Novo, Em análise, Autorizado, Reavaliação), os
// encerrados sem responsável (Não autorizado, à espera do solicitante; Finalizado) e os chamados dos agentes da
// equipe, abertos e encerrados (Atribuído, Em andamento, Concluído, Finalizado).
export async function getQueueBoard(requester: Requester): Promise<GetQueueBoardResult> {
  const [snapshot, unassignedAll, options] = await Promise.all([
    loadSnapshot(requester, { includeClosed: true }),
    searchTicketsByOwner(requester, UNASSIGNED_OWNER_ID),
    loadAgentOptions(),
  ]);
  if (!snapshot.success) return snapshot;
  const { now, queue, perMember, members } = snapshot.data;
  const closedUnassigned = unassignedAll.success ? unassignedAll.data.filter((ticket) => describeState(ticket.state ?? "").closed && flowStepOf(ticket.state) !== null) : [];

  const byId = new Map<number, ZammadExpandedTicket>();
  for (const ticket of [...queue, ...closedUnassigned, ...perMember.flat()]) byId.set(ticket.id, ticket);
  const ownerNames = new Map(members.map((member) => [member.id, member.name]));
  const items = sortQueue(await toRows(requester, [...byId.values()], now, ownerNames), "idade");

  const allocation = await allocationFor(items, loadsOf(snapshot.data));
  return { success: true, data: { items, sectors: sectorChips(items), allocation, counts: countBuckets(items), flowStateIds: flowStateIdsOf(options) } };
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
