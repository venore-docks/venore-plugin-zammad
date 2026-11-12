import { describe, expect, it } from "vitest";
import type { GroupWizardConfig, PeopleGroup, WizardConfig } from "../contracts/types";
import { DEFAULT_GROUP_CONFIG } from "./form";
import {
  addMembers,
  audienceSchema,
  createGroup,
  deleteGroup,
  newGroupId,
  parsePastedEmails,
  parsePeopleGroups,
  removeGroupFromAudiences,
  removeMember,
  sectorsUsingGroup,
  setGroupSectors,
  updateGroup,
} from "./people-groups";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const group = (id: string, name: string, memberIds: string[] = []): PeopleGroup => ({ id, name, description: null, memberIds, createdAt: NOW.toISOString() });

function ok<T>(result: { success: true; data: T } | { success: false; error: { code: string } }): T {
  if (!result.success) throw new Error(`falhou: ${result.error.code}`);
  return result.data;
}

describe("criar, editar e excluir grupos", () => {
  it("cria com nome aparado e sem membros", () => {
    const { groups, group: created } = ok(createGroup([], { name: "  TI  ", description: "  Suporte  " }, { now: NOW, id: "g1" }));
    expect(created).toEqual({ id: "g1", name: "TI", description: "Suporte", memberIds: [], createdAt: NOW.toISOString() });
    expect(groups).toHaveLength(1);
  });

  it("recusa nome vazio, longo e repetido (sem diferenciar maiúsculas)", () => {
    expect(createGroup([], { name: "   " }, { now: NOW }).success).toBe(false);
    expect(createGroup([], { name: "x".repeat(61) }, { now: NOW }).success).toBe(false);
    const repeated = createGroup([group("a", "TI")], { name: "ti" }, { now: NOW });
    expect(repeated.success).toBe(false);
  });

  it("edita nome e descrição; renomear para o próprio nome é permitido", () => {
    const groups = [group("a", "TI"), group("b", "RH")];
    expect(ok(updateGroup(groups, "a", { name: "TI", description: "Novo" })).group.description).toBe("Novo");
    expect(updateGroup(groups, "a", { name: "RH" }).success).toBe(false);
    expect(updateGroup(groups, "zzz", { name: "X" }).success).toBe(false);
  });

  it("exclui", () => {
    expect(ok(deleteGroup([group("a", "TI"), group("b", "RH")], "a")).map((entry) => entry.id)).toEqual(["b"]);
    expect(deleteGroup([], "a").success).toBe(false);
  });

  it("gera ids únicos", () => {
    expect(newGroupId(["g000000"], () => 0)).not.toBe("g000000");
    expect(newGroupId([], () => 0.5)).toMatch(/^g[0-9a-z]{6}$/);
  });
});

describe("membros", () => {
  it("adiciona vários sem repetir e informa quem era novo", () => {
    const result = ok(addMembers([group("a", "TI", ["u1"])], "a", ["u1", "u2", "u2", " u3 ", ""]));
    expect(result.added).toEqual(["u2", "u3"]);
    expect(result.groups[0].memberIds).toEqual(["u1", "u2", "u3"]);
  });

  it("remove membro e recusa grupo inexistente", () => {
    expect(ok(removeMember([group("a", "TI", ["u1", "u2"])], "a", "u1"))[0].memberIds).toEqual(["u2"]);
    expect(removeMember([], "a", "u1").success).toBe(false);
    expect(addMembers([], "a", ["u1"]).success).toBe(false);
  });
});

describe("e-mails colados", () => {
  it("separa por linha, vírgula, ponto e vírgula e espaço; normaliza e tira repetidos", () => {
    const parsed = parsePastedEmails("Ana@fem.edu.br\nbia@fem.edu.br; carla@fem.edu.br, ana@FEM.edu.br  dani@fem.edu.br");
    expect(parsed.emails).toEqual(["ana@fem.edu.br", "bia@fem.edu.br", "carla@fem.edu.br", "dani@fem.edu.br"]);
    expect(parsed.invalid).toEqual([]);
  });

  it("aceita o formato Nome <e-mail> e informa o que não é e-mail", () => {
    const parsed = parsePastedEmails('Ana Souza <ana@fem.edu.br>, "Bia" <bia@fem.edu.br>\nlixo, sem-arroba.com');
    expect(parsed.emails).toEqual(["ana@fem.edu.br", "bia@fem.edu.br"]);
    expect(parsed.invalid).toEqual(["lixo", "sem-arroba.com"]);
  });

  it("limita a quantidade", () => {
    const text = Array.from({ length: 250 }, (_, index) => `p${index}@x.com`).join("\n");
    const parsed = parsePastedEmails(text);
    expect(parsed.emails).toHaveLength(200);
    expect(parsed.truncated).toBe(true);
  });
});

describe("schema", () => {
  it("setting corrompido vira lista vazia; membros repetidos são unificados", () => {
    expect(parsePeopleGroups("lixo")).toEqual([]);
    expect(parsePeopleGroups([{ id: "a", name: "TI", memberIds: ["u1", "u1"], createdAt: "x" }])).toEqual([
      { id: "a", name: "TI", description: null, memberIds: ["u1"], createdAt: "x" },
    ]);
  });

  it("audiência ausente ou inválida cai no padrão (retrocompatível)", () => {
    expect(audienceSchema.parse(undefined)).toEqual({ mode: "inherit", groupIds: [] });
    expect(audienceSchema.parse({ mode: "xyz", groupIds: [] })).toEqual({ mode: "inherit", groupIds: [] });
    expect(audienceSchema.parse({ mode: "groups", groupIds: ["a"] })).toEqual({ mode: "groups", groupIds: ["a"] });
  });
});

describe("referências nos setores", () => {
  const sector = (patch: Partial<GroupWizardConfig> = {}): GroupWizardConfig => ({ ...DEFAULT_GROUP_CONFIG, ...patch });
  const config = (groups: Record<string, GroupWizardConfig>): WizardConfig => ({ intro: null, appName: null, groups });

  it("excluir um grupo limpa a referência nos setores", () => {
    const before = config({
      "1": sector({ audience: { mode: "groups", groupIds: ["a", "b"] } }),
      "2": sector({ audience: { mode: "groups", groupIds: ["a"] } }),
      "3": sector(),
    });
    const after = removeGroupFromAudiences(before, "a");
    expect(after.groups["1"].audience.groupIds).toEqual(["b"]);
    // Ficou sem grupos: continua restrito (oculto), nunca vira "todos" sozinho.
    expect(after.groups["2"].audience).toEqual({ mode: "groups", groupIds: [] });
    expect(after.groups["3"]).toBe(before.groups["3"]);
    expect(removeGroupFromAudiences(before, "nenhum")).toBe(before);
  });

  it("'Setores liberados': marca e desmarca o grupo, criando a config do setor se preciso", () => {
    const before = config({ "1": sector({ audience: { mode: "groups", groupIds: ["a"] } }), "2": sector({ audience: { mode: "groups", groupIds: ["a", "b"] } }) });
    const after = setGroupSectors(before, "a", [2, 5]);
    expect(after.groups["1"].audience.groupIds).toEqual([]);
    expect(after.groups["2"].audience.groupIds).toEqual(["a", "b"]);
    expect(after.groups["5"].audience).toEqual({ mode: "groups", groupIds: ["a"] });
    expect(sectorsUsingGroup(after, "a")).toEqual([2, 5]);
    expect(setGroupSectors(before, "a", [1, 2])).toBe(before);
  });

  it("marcar um setor que era 'todos' passa a restringir a esse grupo", () => {
    const after = setGroupSectors(config({ "1": sector({ audience: { mode: "all", groupIds: [] } }) }), "a", [1]);
    expect(after.groups["1"].audience).toEqual({ mode: "groups", groupIds: ["a"] });
  });
});
