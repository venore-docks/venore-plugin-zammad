import { describe, expect, it } from "vitest";
import type { GroupWizardConfig, PeopleGroup, SectorAudience, WizardConfig } from "../contracts/types";
import { audienceBadge, groupIdsOfUser, isSectorVisible, resolveAudience, type AudienceSector } from "./audience";
import { DEFAULT_GROUP_CONFIG } from "./form";

// Árvore: 1 (raiz) → 2 → 3;  4 (raiz).
const SECTORS: AudienceSector[] = [
  { groupId: 1, parentId: null },
  { groupId: 2, parentId: 1 },
  { groupId: 3, parentId: 2 },
  { groupId: 4, parentId: null },
];

function configWith(audiences: Record<number, SectorAudience>): WizardConfig {
  const groups: Record<string, GroupWizardConfig> = {};
  for (const [id, audience] of Object.entries(audiences)) groups[id] = { ...DEFAULT_GROUP_CONFIG, audience };
  return { intro: null, appName: null, groups };
}

const user = (...groupIds: string[]) => ({ isAdmin: false, groupIds });
const ADMIN = { isAdmin: true, groupIds: [] };

describe("isSectorVisible", () => {
  it("sem configuração todos veem todos os setores (retrocompatível)", () => {
    const config = configWith({});
    for (const sector of SECTORS) expect(isSectorVisible(sector.groupId, SECTORS, config, user())).toBe(true);
  });

  it("modo all libera para todos", () => {
    expect(isSectorVisible(1, SECTORS, configWith({ 1: { mode: "all", groupIds: ["ti"] } }), user())).toBe(true);
  });

  it("modo groups: só quem é membro de algum dos grupos listados", () => {
    const config = configWith({ 1: { mode: "groups", groupIds: ["ti", "rh"] } });
    expect(isSectorVisible(1, SECTORS, config, user("rh"))).toBe(true);
    expect(isSectorVisible(1, SECTORS, config, user("outro", "ti"))).toBe(true);
    expect(isSectorVisible(1, SECTORS, config, user("outro"))).toBe(false);
    expect(isSectorVisible(1, SECTORS, config, user())).toBe(false);
  });

  it("modo groups sem nenhum grupo = ninguém, exceto admin", () => {
    const config = configWith({ 4: { mode: "groups", groupIds: [] } });
    expect(isSectorVisible(4, SECTORS, config, user("ti"))).toBe(false);
    expect(isSectorVisible(4, SECTORS, config, ADMIN)).toBe(true);
  });

  it("admin vê todos, mesmo restritos", () => {
    const config = configWith({ 1: { mode: "groups", groupIds: ["ti"] } });
    for (const sector of SECTORS) expect(isSectorVisible(sector.groupId, SECTORS, config, ADMIN)).toBe(true);
  });

  it("subgrupo com inherit usa a audiência do pai, e a do avô quando o pai também herda", () => {
    const config = configWith({ 1: { mode: "groups", groupIds: ["ti"] } });
    expect(isSectorVisible(2, SECTORS, config, user("ti"))).toBe(true);
    expect(isSectorVisible(3, SECTORS, config, user("ti"))).toBe(true);
    expect(isSectorVisible(2, SECTORS, config, user("rh"))).toBe(false);
    expect(isSectorVisible(3, SECTORS, config, user("rh"))).toBe(false);
  });

  it("subgrupo pode ter audiência própria, diferente da do pai", () => {
    const config = configWith({ 1: { mode: "groups", groupIds: ["ti"] }, 2: { mode: "all", groupIds: [] }, 3: { mode: "groups", groupIds: ["rh"] } });
    expect(isSectorVisible(2, SECTORS, config, user())).toBe(true);
    expect(isSectorVisible(3, SECTORS, config, user("ti"))).toBe(false);
    expect(isSectorVisible(3, SECTORS, config, user("rh"))).toBe(true);
  });

  it("setor raiz com inherit = todos; ciclo de pais não trava", () => {
    expect(isSectorVisible(4, SECTORS, configWith({ 4: { mode: "inherit", groupIds: [] } }), user())).toBe(true);
    const cycle: AudienceSector[] = [
      { groupId: 1, parentId: 2 },
      { groupId: 2, parentId: 1 },
    ];
    expect(isSectorVisible(1, cycle, configWith({}), user())).toBe(true);
  });
});

describe("resolveAudience", () => {
  it("diz de onde veio a regra herdada", () => {
    const config = configWith({ 1: { mode: "groups", groupIds: ["ti"] } });
    expect(resolveAudience(3, SECTORS, config)).toEqual({ mode: "groups", groupIds: ["ti"], sourceSectorId: 1 });
    expect(resolveAudience(4, SECTORS, config)).toEqual({ mode: "all", groupIds: [], sourceSectorId: null });
  });
});

describe("audienceBadge", () => {
  const people: PeopleGroup[] = [
    { id: "ti", name: "TI", description: null, memberIds: [], createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "rh", name: "RH", description: null, memberIds: [], createdAt: "2026-01-01T00:00:00.000Z" },
  ];

  it("Todos, Só: ... e Oculto", () => {
    const config = configWith({ 1: { mode: "groups", groupIds: ["ti", "rh"] }, 4: { mode: "groups", groupIds: ["apagado"] } });
    expect(audienceBadge(2, SECTORS, configWith({}), people)).toMatchObject({ kind: "all", label: "Todos" });
    expect(audienceBadge(1, SECTORS, config, people)).toEqual({ kind: "groups", label: "Só: TI, RH", inherited: false });
    expect(audienceBadge(3, SECTORS, config, people)).toEqual({ kind: "groups", label: "Só: TI, RH", inherited: true });
    expect(audienceBadge(4, SECTORS, config, people)).toMatchObject({ kind: "hidden", label: "Oculto" });
  });
});

describe("groupIdsOfUser", () => {
  it("lista os grupos de pessoas em que o usuário está", () => {
    const groups: PeopleGroup[] = [
      { id: "ti", name: "TI", description: null, memberIds: ["u1", "u2"], createdAt: "" },
      { id: "rh", name: "RH", description: null, memberIds: ["u2"], createdAt: "" },
    ];
    expect(groupIdsOfUser(groups, "u1")).toEqual(["ti"]);
    expect(groupIdsOfUser(groups, "u2")).toEqual(["ti", "rh"]);
    expect(groupIdsOfUser(groups, "u3")).toEqual([]);
  });
});
