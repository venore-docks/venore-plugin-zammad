// Quem atende o quê: grupos, agentes e equipes. Puro (sem Zammad), testado em team-rules.test.ts.
//
// No Zammad o acesso a um grupo vem do PRÓPRIO usuário (`group_ids`) e dos PAPÉIS dele (cada papel tem os
// seus `group_ids`); vale a união. Cada acesso é uma lista: full, change, read, create, overview. Só quem
// tem `full` ou `change` pode ser RESPONSÁVEL por chamados do grupo.
export type DirRole = { id: number; permissions: string[]; groupAccess: Record<string, string[]> };
export type DirUser = { id: number; name: string; email: string | null; active: boolean; roleIds: number[]; groupAccess: Record<string, string[]> };

const OWNER_ACCESS = ["full", "change"];

export function effectiveAccess(user: DirUser, roles: DirRole[]): Map<number, Set<string>> {
  const access = new Map<number, Set<string>>();
  const add = (groups: Record<string, string[]>) => {
    for (const [groupId, kinds] of Object.entries(groups)) {
      const id = Number(groupId);
      access.set(id, new Set([...(access.get(id) ?? []), ...kinds]));
    }
  };
  add(user.groupAccess);
  for (const role of roles) if (user.roleIds.includes(role.id)) add(role.groupAccess);
  return access;
}

export function ownsGroup(access: Map<number, Set<string>>, groupId: number): boolean {
  const kinds = access.get(groupId);
  return Boolean(kinds && OWNER_ACCESS.some((kind) => kinds.has(kind)));
}

// Atende chamados: algum papel com `ticket.agent` (admin entra: admin sempre tem os dois nos papéis do FEM,
// mas vale `admin` sozinho também).
export function isStaffUser(user: DirUser, roles: DirRole[]): boolean {
  return roles.some((role) => user.roleIds.includes(role.id) && (role.permissions.includes("ticket.agent") || role.permissions.includes("admin")));
}

// Quem pode receber chamados do grupo (para alocar).
export function assigneesForGroup(groupId: number, users: DirUser[], roles: DirRole[]): DirUser[] {
  return users
    .filter((user) => user.active && isStaffUser(user, roles) && ownsGroup(effectiveAccess(user, roles), groupId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// Grupos que a pessoa gerencia (onde ela mesma é "dona").
export function managedGroupIds(user: DirUser, roles: DirRole[]): number[] {
  const access = effectiveAccess(user, roles);
  return [...access.keys()].filter((groupId) => ownsGroup(access, groupId)).sort((a, b) => a - b);
}

// A equipe de quem gerencia estes grupos: agentes que respondem por algum deles.
export function teamOf(groupIds: number[], users: DirUser[], roles: DirRole[]): DirUser[] {
  return users
    .filter((user) => {
      if (!user.active || !isStaffUser(user, roles)) return false;
      const access = effectiveAccess(user, roles);
      return groupIds.some((groupId) => ownsGroup(access, groupId));
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
