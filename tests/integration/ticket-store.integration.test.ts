// Banco do Colabora contra um Postgres de verdade (PGlite, em memória): migrations aplicam do zero, eventos são
// idempotentes (repetidos e fora de ordem não duplicam), intervalos são trocados por inteiro numa transação e as notas
// do plugin ficam por chamado.
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./mocks";
import {
  addPluginNote,
  interruptedNote,
  listPluginNotes,
  listTicketEvents,
  listTicketIntervals,
  replaceTicketIntervals,
  saveTicketEvents,
  type TicketEventInput,
} from "../../shared/ticket-store";

const at = (local: string) => new Date(`${local}:00-03:00`);

beforeAll(async () => {
  await applyMigrations(fileURLToPath(new URL("../../migrations", import.meta.url)));
});

describe("eventos (ingestão idempotente)", () => {
  const events: TicketEventInput[] = [
    { eventId: "history:10", ticketId: 501, occurredAt: at("2026-11-26T09:00"), stateId: 1, stateName: "Novo", groupId: 21, source: "history" },
    { eventId: "history:11", ticketId: 501, occurredAt: at("2026-11-26T10:00"), stateId: 2, stateName: "Em análise", groupId: 21, source: "history" },
    { eventId: "history:12", ticketId: 501, occurredAt: at("2026-11-26T11:00"), stateId: 8, stateName: "Em andamento", ownerId: 7, source: "history" },
  ];

  it("grava os novos e devolve quantos entraram", async () => {
    expect(await saveTicketEvents(events)).toBe(3);
  });

  it("o mesmo evento de novo (webhook repetido, conferência) não duplica", async () => {
    expect(await saveTicketEvents(events)).toBe(0);
    expect(await saveTicketEvents([events[1]])).toBe(0);
    expect(await listTicketEvents(501)).toHaveLength(3);
  });

  it("evento fora de ordem entra e a leitura sai em ordem cronológica", async () => {
    const late: TicketEventInput = { eventId: "history:13", ticketId: 501, occurredAt: at("2026-11-26T10:30"), stateId: 7, stateName: "Autorizado", source: "webhook" };
    expect(await saveTicketEvents([late])).toBe(1);
    expect((await listTicketEvents(501)).map((event) => event.stateName)).toEqual(["Novo", "Em análise", "Autorizado", "Em andamento"]);
  });

  it("eventos de outro chamado ficam separados", async () => {
    await saveTicketEvents([{ eventId: "history:99", ticketId: 777, occurredAt: at("2026-11-26T09:00"), stateId: 1, stateName: "Novo", source: "history" }]);
    expect(await listTicketEvents(777)).toHaveLength(1);
    expect(await listTicketEvents(501)).toHaveLength(4);
  });
});

describe("intervalos (derivados, trocados por inteiro)", () => {
  const base = { stateName: "Em andamento", groupId: 21, agentId: 7 };

  it("recalcular duas vezes dá o mesmo conjunto (sem sobra do anterior)", async () => {
    const first = [
      { ...base, ticketId: 501, stateId: 8, startedAt: at("2026-11-26T11:00"), endedAt: at("2026-11-26T12:00"), corridoS: 3600, uteisS: 3600, eventId: "history:12" },
      { ...base, ticketId: 501, stateId: 11, stateName: "Em pausa", startedAt: at("2026-11-26T12:00"), endedAt: null, motivoPausa: "urgencia", eventId: "history:14" },
    ];
    await replaceTicketIntervals(501, first);
    await replaceTicketIntervals(501, first);
    const rows = await listTicketIntervals([501]);
    expect(rows.map((row) => [row.stateId, row.motivoPausa, row.endedAt === null])).toEqual([
      [8, null, false],
      [11, "urgencia", true],
    ]);
  });

  it("um recálculo com menos intervalos não deixa os antigos", async () => {
    await replaceTicketIntervals(501, [{ ...base, ticketId: 501, stateId: 8, startedAt: at("2026-11-26T11:00"), endedAt: null, eventId: "history:12" }]);
    expect(await listTicketIntervals([501])).toHaveLength(1);
  });

  it("não mistura chamados", async () => {
    await replaceTicketIntervals(777, [{ ...base, ticketId: 777, stateId: 1, stateName: "Novo", startedAt: at("2026-11-26T09:00"), endedAt: null, eventId: "history:99" }]);
    expect((await listTicketIntervals([501, 777])).map((row) => row.ticketId)).toEqual([501, 777]);
    await replaceTicketIntervals(777, []);
    expect((await listTicketIntervals([501, 777])).map((row) => row.ticketId)).toEqual([501]);
  });

  it("o mesmo evento de início não vira dois intervalos (chave única)", async () => {
    const twice = { ...base, ticketId: 888, stateId: 8, startedAt: at("2026-11-26T11:00"), endedAt: null, eventId: "history:500" };
    await expect(replaceTicketIntervals(888, [twice, twice])).rejects.toThrow();
    // A transação desfez tudo: nada ficou pela metade.
    expect(await listTicketIntervals([888])).toEqual([]);
  });
});

describe("notas do plugin", () => {
  it("guarda a interrupção por chamado, a mais recente primeiro", async () => {
    await addPluginNote({ ticketId: 601, kind: "interrupted", note: interruptedNote("1001"), relatedTicketId: 700, relatedNumber: "1001", actorId: "portal-1" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await addPluginNote({ ticketId: 601, kind: "interrupted", note: interruptedNote("1002"), relatedTicketId: 701, relatedNumber: "1002", actorId: "portal-1" });
    const notes = await listPluginNotes(601);
    expect(notes.map((note) => note.note)).toEqual(["Interrompido por #1002", "Interrompido por #1001"]);
    expect(await listPluginNotes(602)).toEqual([]);
  });
});
