import { describe, expect, it } from "vitest";
import type { TicketSummary } from "../contracts/types";
import {
  computeAgentStats,
  filterCounts,
  filterTickets,
  isUrgentPriority,
  parseAssignedFilter,
  sortByAttention,
  splitForDashboard,
  tomorrowAtNineLocal,
  waitingLabel,
} from "./agent-stats";

const NOW = new Date("2026-11-12T15:00:00Z");

function ticket(id: number, over: Partial<TicketSummary> = {}): TicketSummary {
  return {
    id,
    number: String(1000 + id),
    title: `Chamado ${id}`,
    group: "TI",
    stateLabel: "Em atendimento",
    stateTone: "open",
    closed: false,
    awaitingYou: false,
    priorityLabel: "Normal",
    requesterName: "Ana",
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-12T14:00:00Z",
    ...over,
  };
}

describe("isUrgentPriority", () => {
  it("reconhece urgente e alta", () => {
    expect(isUrgentPriority("Urgente")).toBe(true);
    expect(isUrgentPriority("Alta")).toBe(true);
    expect(isUrgentPriority("High")).toBe(true);
    expect(isUrgentPriority("Normal")).toBe(false);
    expect(isUrgentPriority("Baixa")).toBe(false);
  });
});

describe("waitingLabel", () => {
  it("formata a espera", () => {
    expect(waitingLabel("2026-11-12T14:59:50Z", NOW)).toBe("agora há pouco");
    expect(waitingLabel("2026-11-12T14:48:00Z", NOW)).toBe("há 12 min");
    expect(waitingLabel("2026-11-12T12:00:00Z", NOW)).toBe("há 3 h");
    expect(waitingLabel("2026-11-11T10:00:00Z", NOW)).toBe("há 1 dia");
    expect(waitingLabel("2026-11-09T10:00:00Z", NOW)).toBe("há 3 dias");
  });
});

describe("computeAgentStats", () => {
  it("conta abertos, aguardando, urgentes, parados e pendentes", () => {
    const list = [
      ticket(1, { awaitingYou: true, updatedAt: "2026-11-10T10:00:00Z" }),
      ticket(2, { awaitingYou: true, updatedAt: "2026-11-12T14:30:00Z", priorityLabel: "Urgente" }),
      ticket(3, { priorityLabel: "Alta", updatedAt: "2026-11-01T10:00:00Z" }),
      ticket(4, { stateTone: "pending" }),
    ];
    expect(computeAgentStats(list, NOW)).toEqual({ open: 4, awaiting: 2, urgent: 2, stale: 1, pending: 1 });
  });
  it("lista vazia zera tudo", () => {
    expect(computeAgentStats([], NOW)).toEqual({ open: 0, awaiting: 0, urgent: 0, stale: 0, pending: 0 });
  });
});

describe("sortByAttention", () => {
  it("aguardando primeiro, depois urgentes, depois o mais antigo", () => {
    const list = [
      ticket(1, { updatedAt: "2026-11-01T00:00:00Z" }),
      ticket(2, { awaitingYou: true, updatedAt: "2026-11-12T10:00:00Z" }),
      ticket(3, { awaitingYou: true, updatedAt: "2026-11-11T10:00:00Z" }),
      ticket(4, { awaitingYou: true, updatedAt: "2026-11-12T11:00:00Z", priorityLabel: "Urgente" }),
    ];
    expect(sortByAttention(list).map((t) => t.id)).toEqual([4, 3, 2, 1]);
  });
  it("não altera o array original", () => {
    const list = [ticket(1), ticket(2, { awaitingYou: true })];
    sortByAttention(list);
    expect(list[0].id).toBe(1);
  });
});

describe("splitForDashboard", () => {
  it("limita cada bloco", () => {
    const list = Array.from({ length: 8 }, (_, index) => ticket(index + 1, { awaitingYou: index % 2 === 0 }));
    const { needsReply, inProgress } = splitForDashboard(list, 3);
    expect(needsReply).toHaveLength(3);
    expect(inProgress).toHaveLength(3);
    expect(needsReply.every((t) => t.awaitingYou)).toBe(true);
  });
});

describe("filtros", () => {
  const list = [ticket(1, { awaitingYou: true }), ticket(2, { priorityLabel: "Alta" }), ticket(3, { stateTone: "pending" })];
  it("normaliza o parâmetro", () => {
    expect(parseAssignedFilter("urgentes")).toBe("urgentes");
    expect(parseAssignedFilter("xyz")).toBe("todos");
    expect(parseAssignedFilter(undefined)).toBe("todos");
  });
  it("conta e filtra", () => {
    expect(filterCounts(list)).toEqual({ todos: 3, aguardando: 1, urgentes: 1, pendentes: 1 });
    expect(filterTickets(list, "pendentes").map((t) => t.id)).toEqual([3]);
    expect(filterTickets(list, "todos")).toHaveLength(3);
  });
});

describe("tomorrowAtNineLocal", () => {
  it("amanhã às 9h no fuso -03:00", () => {
    expect(tomorrowAtNineLocal(NOW)).toBe("2026-11-13T09:00");
  });
  it("depois da meia-noite local ainda conta o dia local", () => {
    // 02:00Z = 23:00 do dia 11 local → amanhã = dia 12
    expect(tomorrowAtNineLocal(new Date("2026-11-12T02:00:00Z"))).toBe("2026-11-12T09:00");
  });
});
