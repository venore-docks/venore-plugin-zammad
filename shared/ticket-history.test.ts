import { describe, expect, it } from "vitest";
import { describeHistoryEntry, toTicketHistory, type RawHistory } from "./ticket-history";

// Recorte no formato de GET /ticket_history/:id do Zammad (sem dados pessoais reais).
const RAW: RawHistory = {
  history: [
    { history_type: "created", history_object: "Ticket", history_attribute: null, created_by_id: 7, created_at: "2026-11-20T11:00:00.000Z" },
    { history_type: "created", history_object: "Ticket::Article", history_attribute: null, created_by_id: 7, created_at: "2026-11-20T11:00:01.000Z" },
    { history_type: "notification", history_object: "Ticket", history_attribute: null, created_by_id: 1, created_at: "2026-11-20T11:00:02.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "state", value_from: "Novo", value_to: "Em análise", created_by_id: 9, created_at: "2026-11-20T12:30:00.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "state", value_from: "Em análise", value_to: "Autorizado", created_by_id: 9, created_at: "2026-11-20T13:00:00.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "owner", value_from: "- -", value_to: "Ana Agente", created_by_id: 9, created_at: "2026-11-20T13:00:05.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "state", value_from: "Autorizado", value_to: "Atribuído", created_by_id: 9, created_at: "2026-11-20T13:00:05.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "tempo_previsto", value_from: "", value_to: "4h", created_by_id: 9, created_at: "2026-11-20T13:01:00.000Z" },
    { history_type: "added", history_object: "Ticket", history_attribute: "tag", value_to: "ajustes", created_by_id: 1, created_at: "2026-11-21T10:00:00.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "group", value_from: "Tecnologia::Suporte", value_to: "Tecnologia::Desenvolvimento", created_by_id: 1, created_at: "2026-11-21T10:05:00.000Z" },
    { history_type: "updated", history_object: "Ticket", history_attribute: "state", value_from: "Atribuído", value_to: "Em andamento", created_by_id: 11, created_at: "2026-11-20T14:00:00.000Z" },
  ],
  assets: { User: { "7": { firstname: "Sol", lastname: "Licitante" }, "9": { firstname: "Gil", lastname: "Gestor" }, "11": { firstname: "Ana", lastname: "Agente" } } },
};

describe("toTicketHistory", () => {
  const entries = toTicketHistory(RAW, { estimateField: "tempo_previsto", estimateLabels: { "4h": "4 horas" } });

  it("guarda abertura e mudanças do chamado, em ordem de data; ignora artigos, avisos e tags", () => {
    expect(entries.map((entry) => entry.kind)).toEqual(["created", "state", "state", "owner", "state", "estimate", "state", "group"]);
    expect(entries.map((entry) => entry.at)).toEqual([...entries.map((entry) => entry.at)].sort());
  });

  it("estado pelo nome do fluxo, responsável vazio como null, setor com ›, tempo previsto pelo rótulo", () => {
    expect(entries[1]).toMatchObject({ kind: "state", from: "Novo", to: "Em análise", byName: "Gil Gestor" });
    expect(entries[3]).toMatchObject({ kind: "owner", from: null, to: "Ana Agente" });
    expect(entries[5]).toMatchObject({ kind: "estimate", from: null, to: "4 horas" });
    expect(entries[7]).toMatchObject({ kind: "group", from: "Tecnologia › Suporte", to: "Tecnologia › Desenvolvimento", byName: "Sistema" });
  });

  it("descreve cada linha", () => {
    expect(describeHistoryEntry(entries[0])).toBe("Chamado aberto");
    expect(describeHistoryEntry(entries[1])).toBe("Estado: Novo → Em análise");
    expect(describeHistoryEntry(entries[3])).toBe("Responsável: sem responsável → Ana Agente");
  });

  it("sem campo de tempo previsto configurado, a mudança dele não entra", () => {
    expect(toTicketHistory(RAW).some((entry) => entry.kind === "estimate")).toBe(false);
  });

  it("resposta vazia ou sem lista vira histórico vazio", () => {
    expect(toTicketHistory({})).toEqual([]);
    expect(toTicketHistory({ history: null })).toEqual([]);
  });

  it("mudança que não muda o rótulo não entra (estado padrão do Zammad com o mesmo nome)", () => {
    const same = toTicketHistory({ history: [{ history_type: "updated", history_object: "Ticket", history_attribute: "state", value_from: "Novo", value_to: "nova", created_at: "2026-11-20T11:00:00.000Z" }] });
    expect(same).toEqual([]);
  });
});
