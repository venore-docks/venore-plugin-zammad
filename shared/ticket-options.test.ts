import { describe, expect, it } from "vitest";
import { buildPriorityOptions, buildStateOptions, pendingTimeToIso, priorityLabel, validatePending } from "./ticket-options";

// Estados e prioridades reais do Zammad da FEM (2026-11-10).
const STATES = [
  { id: 1, name: "new", state_type_id: 1, active: true },
  { id: 2, name: "open", state_type_id: 2, active: true },
  { id: 3, name: "pending reminder", state_type_id: 3, active: true },
  { id: 4, name: "closed", state_type_id: 5, active: true },
  { id: 5, name: "merged", state_type_id: 6, active: true },
  { id: 6, name: "pending close", state_type_id: 4, active: true },
  { id: 7, name: "em andamento", state_type_id: 2, active: true },
];
const PRIORITIES = [
  { id: 4, name: "4 urgente", active: true },
  { id: 1, name: "1 low", active: true },
  { id: 2, name: "2 normal", active: true },
  { id: 3, name: "3 high", active: false },
];

describe("buildStateOptions", () => {
  it("esconde 'merged', ordena por fase e marca os que pedem data", () => {
    const options = buildStateOptions(STATES);
    expect(options.map((o) => o.name)).toEqual(["new", "open", "em andamento", "pending reminder", "pending close", "closed"]);
    expect(options.filter((o) => o.needsPending).map((o) => o.name)).toEqual(["pending reminder", "pending close"]);
    expect(options.find((o) => o.name === "em andamento")).toMatchObject({ label: "Em andamento", tone: "open" });
  });
});

describe("prioridades", () => {
  it("rótulo sem o número, só as ativas, em ordem", () => {
    expect(priorityLabel("2 normal")).toBe("Normal");
    expect(buildPriorityOptions(PRIORITIES).map((p) => p.label)).toEqual(["Low", "Normal", "Urgente"]);
  });
});

describe("pendência", () => {
  const pending = buildStateOptions(STATES).find((o) => o.name === "pending reminder")!;
  const open = buildStateOptions(STATES).find((o) => o.name === "open")!;
  const NOW = new Date("2026-11-10T15:00:00Z"); // 12:00 em Brasília

  it("converte datetime-local para ISO com o fuso do plugin", () => {
    expect(pendingTimeToIso("2026-11-12T09:30")).toBe("2026-11-12T09:30:00-03:00");
    expect(pendingTimeToIso("12/11/2026")).toBeNull();
  });

  it("estado com pendência exige data futura; os demais ignoram", () => {
    expect(validatePending(open, null, NOW)).toBeNull();
    expect(validatePending(pending, null, NOW)).toMatch(/até quando/);
    expect(validatePending(pending, "2026-11-10T11:00", NOW)).toMatch(/futuro/);
    expect(validatePending(pending, "2026-11-12T09:30", NOW)).toBeNull();
    expect(validatePending(pending, "lixo", NOW)).toMatch(/inválidas/);
  });
});
