import type { TicketSummary } from "../contracts/types";

// Estatísticas e ordenação dos chamados atribuídos ao agente. Puro: testado em agent-stats.test.ts.
// Para quem atende, `awaitingYou` = o solicitante falou por último (o chamado espera a resposta do agente).

export const STALE_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type Waitable = Pick<TicketSummary, "awaitingYou" | "priorityLabel" | "stateTone" | "updatedAt">;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// "Urgente", "Alta", "High", "Crítica" contam como urgentes; "Normal"/"Baixa" não.
export function isUrgentPriority(label: string): boolean {
  const text = normalize(label);
  return /(urgen|alta|high|critic|crit)/.test(text);
}

// O peso da prioridade para ordenar: urgente (2) > alta (1) > resto (0).
function priorityRank(label: string): number {
  const text = normalize(label);
  if (/(urgen|critic)/.test(text)) return 2;
  if (/(alta|high)/.test(text)) return 1;
  return 0;
}

function timeOf(iso: string): number {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

// Milissegundos que o chamado está parado desde a última atualização (nunca negativo).
export function waitingMs(ticket: Pick<TicketSummary, "updatedAt">, now: Date = new Date()): number {
  return Math.max(0, now.getTime() - timeOf(ticket.updatedAt));
}

// "agora há pouco", "há 12 min", "há 3 h", "há 2 dias".
export function waitingLabel(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - timeOf(iso));
  if (diff < MINUTE_MS) return "agora há pouco";
  if (diff < HOUR_MS) return `há ${Math.floor(diff / MINUTE_MS)} min`;
  if (diff < 24 * HOUR_MS) return `há ${Math.floor(diff / HOUR_MS)} h`;
  const days = Math.floor(diff / (24 * HOUR_MS));
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

// O solicitante espera retorno há mais de `hours` horas.
export function isStale(ticket: Waitable, now: Date = new Date(), hours: number = STALE_HOURS): boolean {
  return ticket.awaitingYou && waitingMs(ticket, now) >= hours * HOUR_MS;
}

export type AgentStats = {
  /** Atribuídos em aberto. */
  open: number;
  /** O solicitante falou por último: espera a resposta do agente. */
  awaiting: number;
  /** Prioridade alta/urgente. */
  urgent: number;
  /** Solicitante esperando retorno há mais de 24 h. */
  stale: number;
  /** Pendentes (aguardando retorno com data). */
  pending: number;
};

export function computeAgentStats(tickets: TicketSummary[], now: Date = new Date()): AgentStats {
  return {
    open: tickets.length,
    awaiting: tickets.filter((ticket) => ticket.awaitingYou).length,
    urgent: tickets.filter((ticket) => isUrgentPriority(ticket.priorityLabel)).length,
    stale: tickets.filter((ticket) => isStale(ticket, now)).length,
    pending: tickets.filter((ticket) => ticket.stateTone === "pending").length,
  };
}

// Ordem de atenção: esperando o agente primeiro, depois prioridade (urgente antes), depois o mais antigo.
export function sortByAttention(tickets: TicketSummary[]): TicketSummary[] {
  return [...tickets].sort((a, b) => {
    if (a.awaitingYou !== b.awaitingYou) return a.awaitingYou ? -1 : 1;
    const byPriority = priorityRank(b.priorityLabel) - priorityRank(a.priorityLabel);
    if (byPriority !== 0) return byPriority;
    return timeOf(a.updatedAt) - timeOf(b.updatedAt);
  });
}

// "Precisam da sua resposta": os mais urgentes e mais antigos primeiro. "Em andamento": o resto, pela mesma regra.
export function splitForDashboard(tickets: TicketSummary[], limit = 5): { needsReply: TicketSummary[]; inProgress: TicketSummary[] } {
  const sorted = sortByAttention(tickets);
  return {
    needsReply: sorted.filter((ticket) => ticket.awaitingYou).slice(0, limit),
    inProgress: sorted.filter((ticket) => !ticket.awaitingYou).slice(0, limit),
  };
}

export type AssignedFilter = "todos" | "aguardando" | "urgentes" | "pendentes";

export const ASSIGNED_FILTERS: { key: AssignedFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando", label: "Aguardando minha resposta" },
  { key: "urgentes", label: "Urgentes" },
  { key: "pendentes", label: "Pendentes" },
];

export function parseAssignedFilter(value: string | undefined): AssignedFilter {
  return ASSIGNED_FILTERS.some((filter) => filter.key === value) ? (value as AssignedFilter) : "todos";
}

export function matchesFilter(ticket: TicketSummary, filter: AssignedFilter): boolean {
  switch (filter) {
    case "aguardando":
      return ticket.awaitingYou;
    case "urgentes":
      return isUrgentPriority(ticket.priorityLabel);
    case "pendentes":
      return ticket.stateTone === "pending";
    default:
      return true;
  }
}

export function filterTickets(tickets: TicketSummary[], filter: AssignedFilter): TicketSummary[] {
  return sortByAttention(tickets.filter((ticket) => matchesFilter(ticket, filter)));
}

export function filterCounts(tickets: TicketSummary[]): Record<AssignedFilter, number> {
  return {
    todos: tickets.length,
    aguardando: tickets.filter((ticket) => matchesFilter(ticket, "aguardando")).length,
    urgentes: tickets.filter((ticket) => matchesFilter(ticket, "urgentes")).length,
    pendentes: tickets.filter((ticket) => matchesFilter(ticket, "pendentes")).length,
  };
}

// Atalhos de "pendente até…": amanhã às 9h (horário local fixo do plugin, -03:00), no formato do datetime-local.
export function tomorrowAtNineLocal(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 3 * HOUR_MS);
  const tomorrow = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1, 9, 0));
  return tomorrow.toISOString().slice(0, 16);
}
