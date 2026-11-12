import { describe, expect, it } from "vitest";
import { buildHints, type HintInput } from "./admin-hints";

const OK: HintInput = {
  connection: { configured: true, error: null },
  sectors: [{ groupId: 1, name: "TI", enabled: true, fieldCount: 3, audienceKind: "all" }],
  peopleGroups: [{ id: "g1", name: "TI", memberCount: 4, sectorCount: 1 }],
  appName: "Colabora FEM",
  unsupportedCount: 0,
};

describe("buildHints", () => {
  it("tudo certo = nenhuma pendência", () => {
    expect(buildHints(OK)).toEqual([]);
  });

  it("sem conexão configurada só mostra isso", () => {
    const hints = buildHints({ ...OK, connection: { configured: false }, peopleGroups: [] });
    expect(hints.map((hint) => hint.id)).toEqual(["no-connection"]);
  });

  it("nenhum grupo de pessoas criado", () => {
    expect(buildHints({ ...OK, peopleGroups: [] }).map((hint) => hint.id)).toEqual(["no-people-groups"]);
  });

  it("setor sem perguntas, setor oculto por audiência e grupo sem membros apontam para a tela certa", () => {
    const hints = buildHints({
      ...OK,
      sectors: [
        { groupId: 2, name: "RH", enabled: true, fieldCount: 0, audienceKind: "all" },
        { groupId: 3, name: "Financeiro", enabled: true, fieldCount: 2, audienceKind: "hidden" },
        { groupId: 4, name: "Desativado", enabled: false, fieldCount: 0, audienceKind: "hidden" },
      ],
      peopleGroups: [{ id: "g9", name: "Vazio", memberCount: 0, sectorCount: 0 }],
    });
    expect(hints.map((hint) => [hint.id, hint.href])).toEqual([
      ["sector-hidden-3", "/admin/colabora/setores/3"],
      ["sector-empty-2", "/admin/colabora/setores/2"],
      ["group-empty-g9", "/admin/colabora/grupos/g9"],
    ]);
  });

  it("grupo com gente mas sem setor liberado, app sem nome e regras não suportadas", () => {
    const hints = buildHints({ ...OK, peopleGroups: [{ id: "g1", name: "TI", memberCount: 2, sectorCount: 0 }], appName: null, unsupportedCount: 2 });
    expect(hints.map((hint) => hint.id)).toEqual(["unsupported-rules", "group-unused-g1", "no-app-name"]);
    expect(hints[0].title).toContain("2 regras");
  });

  it("erro de conexão vem primeiro", () => {
    const hints = buildHints({ ...OK, connection: { configured: true, error: "timeout" }, appName: null });
    expect(hints[0]).toMatchObject({ id: "connection-error", tone: "destructive" });
  });
});
