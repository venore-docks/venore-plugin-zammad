import { describe, expect, it } from "vitest";
import { FEM_SCHEMA_LIVE } from "./__fixtures__/fem-schema-live";
import { FALLBACK_CALENDAR } from "./business-hours";
import { DEADLINE_FIELD, deadlineToLocal, deadlineToZammad, defaultDeadline } from "./deadline";
import { FLOW_STEPS, allowedTargets, canMoveTo, flowStepOf, inProgressToPause, staffActionsFor, staffHintFor } from "./flow";
import { bucketOf } from "./queue-buckets";
import { missingForChange } from "./transition";
import { updateNotice } from "./update-notice";

// Em pausa (v1.12.0): estado 11 do Zammad da FEM, só sai para Em andamento; pausar pede o motivo; um agente tem
// um chamado Em andamento por vez; tempo previsto e prazo ganham 1 dia útil quando ninguém os definiu.

const agente = { supervisor: false, worker: true };
const gestor = { supervisor: true, worker: false };

describe("Em pausa no fluxo", () => {
  it("reconhecido pelo nome, aberto, na aba própria da fila", () => {
    expect(flowStepOf("Em pausa")).toBe("em_pausa");
    expect(FLOW_STEPS.em_pausa.closed).toBe(false);
    expect(bucketOf("em_pausa", true)).toBe("pausa");
  });

  it("o responsável E o gestor pausam e retomam; Em pausa só volta para Em andamento", () => {
    expect(canMoveTo("em_andamento", "em_pausa", agente)).toBe(true);
    expect(canMoveTo("em_andamento", "em_pausa", gestor)).toBe(true);
    expect(allowedTargets("em_pausa", gestor)).toEqual(["em_andamento"]);
    expect(allowedTargets("em_pausa", agente)).toEqual(["em_andamento"]);
    expect(canMoveTo("em_pausa", "concluido", { supervisor: true, worker: true })).toBe(false);
    expect(canMoveTo("atribuido", "em_pausa", agente)).toBe(false);
  });

  it("botões: Pausar em Em andamento; Retomar em Em pausa", () => {
    expect(staffActionsFor("em_andamento", gestor).map((action) => action.label)).toEqual(["Pausar", "Aguardar solicitante"]);
    expect(staffActionsFor("em_pausa", agente)).toMatchObject([{ target: "em_andamento", label: "Retomar" }]);
    expect(staffHintFor("em_pausa", { ...agente, hasOwner: true })).toMatch(/Retomar/);
  });
});

describe("um chamado Em andamento por agente", () => {
  const tickets = [
    { id: 1, number: "1001", state: "Em andamento" },
    { id: 2, number: "1002", state: "Em pausa" },
    { id: 3, number: "1003", state: "Em andamento" },
    { id: 4, number: "1004", state: "Atribuído" },
  ];

  it("ao iniciar o #2, pausa os outros Em andamento (não o próprio, nem os de outras etapas)", () => {
    expect(inProgressToPause(tickets, 2).map((ticket) => ticket.id)).toEqual([1, 3]);
  });

  it("retomar um que já está Em andamento não pausa a si mesmo", () => {
    expect(inProgressToPause(tickets, 1).map((ticket) => ticket.id)).toEqual([3]);
  });

  it("o aviso conta o que foi pausado e os padrões aplicados", () => {
    expect(updateNotice({ paused: [{ number: "1001" }], defaults: [] })).toBe("O chamado #1001, que estava em andamento, foi pausado (urgência).");
    expect(updateNotice({ paused: [], defaults: ["estimate", "deadline"] })).toBe("Tempo previsto e prazo de entrega ficaram em 1 dia útil (padrão).");
    expect(updateNotice({ paused: [], defaults: [] })).toBeNull();
  });
});

describe("prazo de entrega", () => {
  it("padrão: 1 dia útil a partir de agora pelo calendário (sexta 16h → segunda 16h)", () => {
    expect(defaultDeadline(new Date("2026-11-27T16:00:00-03:00"), FALLBACK_CALENDAR)).toBe(new Date("2026-11-30T16:00:00-03:00").toISOString());
  });

  it("converte entre o campo da tela (UTC-3) e o Zammad", () => {
    expect(deadlineToZammad("2026-12-01T17:00")).toBe("2026-12-01T20:00:00.000Z");
    expect(deadlineToZammad("amanhã")).toBeNull();
    expect(deadlineToLocal("2026-12-01T20:00:00.000Z")).toBe("2026-12-01T17:00");
    expect(deadlineToLocal(null)).toBeNull();
  });
});

describe("o que a mudança exige (Zammad real, tela de edição)", () => {
  const context = { roleIds: [2], userId: 99 };
  const ticket = (state: number, extra: Record<string, unknown> = {}) => ({ group_id: 21, state_id: state, ...extra });

  it("atribuir (7 → 10) sem tempo e prazo: os dois faltam", () => {
    const missing = missingForChange(FEM_SCHEMA_LIVE, ticket(7), { state_id: 10 }, context).map((field) => field.name);
    expect(missing).toEqual(expect.arrayContaining(["tempo_previsto", DEADLINE_FIELD]));
  });

  it("com tempo e prazo já no chamado, nada falta", () => {
    const filled = ticket(7, { tempo_previsto: "2h", [DEADLINE_FIELD]: "2026-12-01T20:00:00Z" });
    const missing = missingForChange(FEM_SCHEMA_LIVE, filled, { state_id: 10 }, context).map((field) => field.name);
    expect(missing).not.toContain("tempo_previsto");
    expect(missing).not.toContain(DEADLINE_FIELD);
  });

  it("pausar (8 → 11) exige o motivo, com as opções do Zammad", () => {
    const missing = missingForChange(FEM_SCHEMA_LIVE, ticket(8, { tempo_previsto: "1d", [DEADLINE_FIELD]: "2026-12-01T20:00:00Z" }), { state_id: 11 }, context);
    const reason = missing.find((field) => field.name === "motivo_pausa");
    expect(reason?.options.map((option) => option.value)).toEqual(["urgencia", "aguardando_solicitante", "outro"]);
    // Com o motivo no mesmo envio, nada falta.
    expect(missingForChange(FEM_SCHEMA_LIVE, ticket(8, { tempo_previsto: "1d", [DEADLINE_FIELD]: "x" }), { state_id: 11, motivo_pausa: "outro" }, context)).toEqual(
      missing.filter((field) => field.name !== "motivo_pausa"),
    );
  });
});
