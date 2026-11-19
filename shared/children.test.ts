import { describe, expect, it } from "vitest";
import type { ZammadGroup } from "../contracts/zammad";
import { childGroupOptions, childOrigin, childrenBlockMessage, isChildMode, openChildren } from "./children";

const groups: ZammadGroup[] = [
  { id: 1, name: "Manutenção", parent_id: null, active: true },
  { id: 3, name: "Recursos Humanos", parent_id: null, active: true },
  { id: 31, name: "Recursos Humanos::Benefícios", parent_id: 3, active: true },
  { id: 4, name: "Tecnologia", parent_id: null, active: true },
  { id: 9, name: "Antigo", parent_id: null, active: false },
];

describe("chamados filhos", () => {
  it("setores para pedir: ativos, sem o setor do pai, com o caminho legível", () => {
    expect(childGroupOptions(groups, 1)).toEqual([
      { id: 3, label: "Recursos Humanos" },
      { id: 31, label: "Recursos Humanos › Benefícios" },
      { id: 4, label: "Tecnologia" },
    ]);
  });

  it("conta só os filhos abertos e explica o bloqueio", () => {
    expect(openChildren([{ closed: false }, { closed: true }, { closed: false }])).toBe(2);
    expect(openChildren([])).toBe(0);
    expect(childrenBlockMessage(1)).toMatch(/Falta 1 chamado filho/);
    expect(childrenBlockMessage(3)).toMatch(/Faltam 3 chamados filhos/);
  });

  it("modo válido e origem no corpo", () => {
    expect(isChildMode("subtask")).toBe(true);
    expect(isChildMode("sector")).toBe(true);
    expect(isChildMode("outro")).toBe(false);
    expect(childOrigin({ number: "37117", title: "Fibra" })).toBe("Chamado filho de #37117 — Fibra");
  });
});
