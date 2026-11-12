import type { TicketSummary } from "../contracts/types";

// Estatísticas puras dos chamados da própria pessoa (dashboard e filtros de "Meus chamados").
// Sem I/O: o relógio entra por parâmetro (`now`) para os testes serem determinísticos.

export const RECENT_CLOSED_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CustomerStats = {
  /** Abertos (não encerrados), inclusive os que aguardam a pessoa. */
  inProgress: number;
  /** A equipe respondeu e a vez é da pessoa (e o chamado não está encerrado). */
  awaitingYou: number;
  /** Encerrados com última atualização dentro dos últimos 30 dias. */
  closedRecently: number;
  total: number;
};

export type MineFilter = "todos" | "andamento" | "aguardando" | "encerrados";

export const MINE_FILTERS: MineFilter[] = ["todos", "andamento", "aguardando", "encerrados"];

function time(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

export function isAwaiting(ticket: TicketSummary): boolean {
  return !ticket.closed && ticket.awaitingYou;
}

export function isClosedRecently(ticket: TicketSummary, now: number, days = RECENT_CLOSED_DAYS): boolean {
  return ticket.closed && now - time(ticket.updatedAt) <= days * DAY_MS;
}

/** Mais recentemente atualizados primeiro (não altera a lista de entrada). */
export function sortByUpdated(tickets: TicketSummary[]): TicketSummary[] {
  return [...tickets].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

export function latestTickets(tickets: TicketSummary[], limit: number): TicketSummary[] {
  return sortByUpdated(tickets).slice(0, Math.max(0, limit));
}

export function computeCustomerStats(tickets: TicketSummary[], now: number): CustomerStats {
  return {
    inProgress: tickets.filter((ticket) => !ticket.closed).length,
    awaitingYou: tickets.filter(isAwaiting).length,
    closedRecently: tickets.filter((ticket) => isClosedRecently(ticket, now)).length,
    total: tickets.length,
  };
}

/** Normaliza `?filtro=`; valor desconhecido vira "todos". */
export function parseMineFilter(value: string | undefined): MineFilter {
  return MINE_FILTERS.find((filter) => filter === value) ?? "todos";
}

export function matchesFilter(ticket: TicketSummary, filter: MineFilter): boolean {
  if (filter === "andamento") return !ticket.closed;
  if (filter === "aguardando") return isAwaiting(ticket);
  if (filter === "encerrados") return ticket.closed;
  return true;
}

export function filterTickets(tickets: TicketSummary[], filter: MineFilter): TicketSummary[] {
  return sortByUpdated(tickets.filter((ticket) => matchesFilter(ticket, filter)));
}

export function countByFilter(tickets: TicketSummary[]): Record<MineFilter, number> {
  return {
    todos: tickets.length,
    andamento: tickets.filter((ticket) => matchesFilter(ticket, "andamento")).length,
    aguardando: tickets.filter((ticket) => matchesFilter(ticket, "aguardando")).length,
    encerrados: tickets.filter((ticket) => matchesFilter(ticket, "encerrados")).length,
  };
}

/** Busca simples de setor (sem acento, sem caixa) por nome ou descrição. */
export function matchesSearch(text: string, query: string): boolean {
  const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const needle = fold(query).trim();
  return needle === "" || fold(text).includes(needle);
}
