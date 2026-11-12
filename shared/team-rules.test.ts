import { describe, expect, it } from "vitest";
import { assigneesForGroup, effectiveAccess, managedGroupIds, memberGroupIds, ownsGroup, resolveAllocation, teamOf, type DirRole, type DirUser } from "./team-rules";

// Papéis e usuários reais do Zammad da FEM (2026-11-10).
const ROLES: DirRole[] = [
  { id: 1, permissions: ["admin", "report", "ticket.agent"], groupAccess: { "1": ["full"], "2": ["full"], "4": ["full"], "13": ["full"] } },
  { id: 2, permissions: ["ticket.agent"], groupAccess: { "1": ["full"], "2": ["read", "create", "overview"] } },
  { id: 3, permissions: ["ticket.customer"], groupAccess: {} },
  { id: 4, permissions: ["ticket.agent"], groupAccess: { "1": ["read", "create", "overview"], "2": ["full"], "6": ["read", "create", "overview"] } },
  { id: 5, permissions: ["ticket.agent"], groupAccess: { "1": ["full"], "2": ["full"] } },
  { id: 6, permissions: ["ticket.agent"], groupAccess: { "1": ["create"], "2": ["create", "read"], "3": ["read", "create"], "6": ["full"] } },
  { id: 7, permissions: ["report", "ticket.agent"], groupAccess: { "6": ["full"] } },
  { id: 8, permissions: ["report", "ticket.agent"], groupAccess: { "1": ["full"] } },
];
const user = (id: number, name: string, roleIds: number[], groupAccess: Record<string, string[]> = {}, active = true): DirUser => ({
  id,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@fem.edu.br`,
  active,
  roleIds,
  groupAccess,
});
const USERS: DirUser[] = [
  user(93, "Felipe Cardoso", [3, 1, 4]), // admin + agente da Tecnologia
  user(96, "Francianne Duek", [3, 6]), // agente de Marketing (grupo só pelo papel)
  user(97, "Andre Warkentin", [3, 6, 7], { "6": ["full"] }), // gestor de Marketing
  user(98, "Friedbert Wall", [3, 5, 2, 4], { "1": ["full"], "2": ["full"] }), // agente Manutenção/Tecnologia/Inspetoria
  user(500, "Colaborador Comum", [3]),
  user(501, "Ex Agente", [3, 6], {}, false),
];

describe("acesso a grupos (usuário + papéis)", () => {
  it("a Francianne não tem grupo direto, mas o papel dela dá Marketing completo", () => {
    const access = effectiveAccess(USERS[1], ROLES);
    expect(ownsGroup(access, 6)).toBe(true);
    // 'create'/'read' em Manutenção NÃO basta para ser responsável
    expect(ownsGroup(access, 1)).toBe(false);
  });

  it("acessos somam usuário e papéis", () => {
    const access = effectiveAccess(USERS[3], ROLES);
    expect([...access.get(2)!].sort()).toEqual(["create", "full", "overview", "read"]);
  });
});

describe("quem recebe chamados de cada grupo", () => {
  it("Marketing (6): a agente, o gestor — não o agente da Tecnologia (só leitura), nem inativo, nem cliente", () => {
    expect(assigneesForGroup(6, USERS, ROLES).map((u) => u.name)).toEqual(["Andre Warkentin", "Francianne Duek"]);
  });

  it("Manutenção (1): Felipe (admin), Friedbert", () => {
    expect(assigneesForGroup(1, USERS, ROLES).map((u) => u.name)).toEqual(["Felipe Cardoso", "Friedbert Wall"]);
  });

  it("grupo sem agentes (Zeladoria, 5) não tem ninguém para receber", () => {
    expect(assigneesForGroup(5, USERS, ROLES)).toEqual([]);
  });
});

describe("setores de cada agente", () => {
  it("só os grupos informados que o agente atende como responsável", () => {
    expect(memberGroupIds(USERS[3], ROLES, [1, 2, 6])).toEqual([1, 2]);
    expect(memberGroupIds(USERS[1], ROLES, [1, 2, 6])).toEqual([6]);
    expect(memberGroupIds(USERS[4], ROLES, [1, 2, 6])).toEqual([]);
  });
});

describe("regra de alocação", () => {
  const assignees = [{ id: 97 }, { id: 96 }];

  it("atribuir a quem atende o setor muda o responsável", () => {
    expect(resolveAllocation({ targetOwnerId: 96, currentOwnerId: 1, assignees, queueOwnerId: 1 })).toEqual({ ok: true, target: 96, changed: true });
  });

  it("recusa quem não atende o setor", () => {
    const result = resolveAllocation({ targetOwnerId: 98, currentOwnerId: 1, assignees, queueOwnerId: 1 });
    expect(result.ok).toBe(false);
  });

  it("devolver à fila de um chamado já na fila não muda nada", () => {
    expect(resolveAllocation({ targetOwnerId: null, currentOwnerId: null, assignees, queueOwnerId: 1 })).toEqual({ ok: true, target: 1, changed: false });
    expect(resolveAllocation({ targetOwnerId: null, currentOwnerId: 1, assignees, queueOwnerId: 1 })).toEqual({ ok: true, target: 1, changed: false });
  });

  it("devolver à fila de um chamado atribuído muda, e realocar ao mesmo agente não", () => {
    expect(resolveAllocation({ targetOwnerId: null, currentOwnerId: 97, assignees, queueOwnerId: 1 })).toEqual({ ok: true, target: 1, changed: true });
    expect(resolveAllocation({ targetOwnerId: 97, currentOwnerId: 97, assignees, queueOwnerId: 1 })).toEqual({ ok: true, target: 97, changed: false });
  });
});

describe("gestão e equipe", () => {
  it("o gestor de Marketing gerencia o grupo 6 e a equipe é quem responde por ele", () => {
    const andre = USERS[2];
    expect(managedGroupIds(andre, ROLES)).toEqual([6]);
    expect(teamOf([6], USERS, ROLES).map((u) => u.name)).toEqual(["Andre Warkentin", "Francianne Duek"]);
  });

  it("equipe de vários grupos junta sem repetir", () => {
    expect(teamOf([1, 2, 6], USERS, ROLES).map((u) => u.name)).toEqual(["Andre Warkentin", "Felipe Cardoso", "Francianne Duek", "Friedbert Wall"]);
  });
});
