import { describe, expect, it } from "vitest";
import type { TicketSummary } from "../contracts/types";
import { computeCustomerStats, countByFilter, filterTickets, latestTickets, matchesSearch, parseMineFilter } from "./customer-stats";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const day = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function ticket(id: number, over: Partial<TicketSummary> = {}): TicketSummary {
  return {
    id,
    number: String(id),
    title: `Chamado ${id}`,
    group: "TI",
    stateLabel: "Aberto",
    stateTone: "open",
    closed: false,
    awaitingYou: false,
    priorityLabel: "Normal",
    requesterName: null,
    createdAt: day(40),
    updatedAt: day(1),
    ...over,
  };
}

const LIST = [
  ticket(1, { updatedAt: day(5) }),
  ticket(2, { awaitingYou: true, updatedAt: day(2) }),
  ticket(3, { closed: true, stateTone: "closed", updatedAt: day(10) }),
  ticket(4, { closed: true, stateTone: "closed", updatedAt: day(45) }),
  ticket(5, { closed: true, awaitingYou: true, stateTone: "closed", updatedAt: day(30) }),
];

describe("computeCustomerStats", () => {
  it("conta em andamento, aguardando e encerrados recentes (limite de 30 dias inclusive)", () => {
    expect(computeCustomerStats(LIST, NOW)).toEqual({ inProgress: 2, awaitingYou: 1, closedRecently: 2, total: 5 });
  });
  it("lista vazia", () => {
    expect(computeCustomerStats([], NOW)).toEqual({ inProgress: 0, awaitingYou: 0, closedRecently: 0, total: 0 });
  });
});

describe("latestTickets / filterTickets", () => {
  it("ordena por atualização e limita sem mutar a entrada", () => {
    const before = LIST.map((t) => t.id);
    expect(latestTickets(LIST, 2).map((t) => t.id)).toEqual([2, 1]);
    expect(LIST.map((t) => t.id)).toEqual(before);
  });
  it("filtra por aba", () => {
    expect(filterTickets(LIST, "andamento").map((t) => t.id)).toEqual([2, 1]);
    expect(filterTickets(LIST, "aguardando").map((t) => t.id)).toEqual([2]);
    expect(filterTickets(LIST, "encerrados").map((t) => t.id)).toEqual([3, 5, 4]);
    expect(filterTickets(LIST, "todos")).toHaveLength(5);
  });
  it("conta por aba", () => {
    expect(countByFilter(LIST)).toEqual({ todos: 5, andamento: 2, aguardando: 1, encerrados: 3 });
  });
});

describe("parseMineFilter / matchesSearch", () => {
  it("valor desconhecido vira todos", () => {
    expect(parseMineFilter("aguardando")).toBe("aguardando");
    expect(parseMineFilter("xyz")).toBe("todos");
    expect(parseMineFilter(undefined)).toBe("todos");
  });
  it("busca sem acento nem caixa", () => {
    expect(matchesSearch("Tecnologia da Informação", "informacao")).toBe(true);
    expect(matchesSearch("Marketing", "rh")).toBe(false);
    expect(matchesSearch("Marketing", "  ")).toBe(true);
  });
});
