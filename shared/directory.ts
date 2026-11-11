import "server-only";
import { staffRoleOf, type StaffRole } from "./access-rules";
import type { Requester } from "./requester";
import { assigneesForGroup, managedGroupIds, teamOf, type DirRole, type DirUser } from "./team-rules";
import { zammadRequest } from "./zammad-client";

// Papéis, usuários e grupos do Zammad (quem atende o quê), lidos com o token da integração e guardados
// em memória por poucos minutos: mudam raramente e a conversa os consulta a cada abertura de chamado.
// Falha de leitura = vazio/"colaborador comum" (falha segura: nunca concede acesso a mais).
type ZammadRoleRaw = { id: number; permissions?: string[]; group_ids?: Record<string, string[]> };
type ZammadUserRaw = {
  id: number;
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  active: boolean;
  role_ids?: number[];
  group_ids?: Record<string, string[]>;
};

const TTL_MS = 5 * 60 * 1000;
const SEARCH_LIMIT = 200;

let rolesCache: { at: number; roles: DirRole[] } | null = null;
let usersCache: { at: number; users: DirUser[] } | null = null;

export async function loadDirRoles(): Promise<DirRole[] | null> {
  if (rolesCache && Date.now() - rolesCache.at < TTL_MS) return rolesCache.roles;
  const result = await zammadRequest<ZammadRoleRaw[]>("roles?expand=true");
  if (!result.success || !Array.isArray(result.data)) return null;
  const roles = result.data.map((role) => ({ id: role.id, permissions: role.permissions ?? [], groupAccess: role.group_ids ?? {} }));
  rolesCache = { at: Date.now(), roles };
  return roles;
}

// A EQUIPE de atendimento (quem tem papel com ticket.agent/admin), não todos os usuários: a lista completa
// passa de 500 pessoas e leva ~10 s por página no Zammad. Uma busca por papel (≈0,5 s) em paralelo e união.
export async function loadDirUsers(): Promise<DirUser[] | null> {
  if (usersCache && Date.now() - usersCache.at < TTL_MS) return usersCache.users;
  const roles = await loadDirRoles();
  if (!roles) return null;
  const staffRoles = roles.filter((role) => role.permissions.includes("ticket.agent") || role.permissions.includes("admin"));
  const found = await Promise.all(staffRoles.map((role) => zammadRequest<ZammadUserRaw[]>(`users/search?query=role_ids:${role.id}&limit=${SEARCH_LIMIT}`)));
  if (found.some((result) => !result.success)) return null;

  const byId = new Map<number, DirUser>();
  for (const result of found) {
    if (!result.success || !Array.isArray(result.data)) continue;
    for (const user of result.data) {
      if (byId.has(user.id)) continue;
      const name = [user.firstname, user.lastname].filter(Boolean).join(" ").trim();
      byId.set(user.id, {
        id: user.id,
        name: name || user.email || `Pessoa #${user.id}`,
        email: user.email ? user.email.trim().toLowerCase() : null,
        active: user.active,
        roleIds: user.role_ids ?? [],
        groupAccess: user.group_ids ?? {},
      });
    }
  }
  const users = [...byId.values()];
  usersCache = { at: Date.now(), users };
  return users;
}

// Papel da pessoa no atendimento: customer | agent | manager | admin (ver access-rules.staffRoleOf).
export async function staffRoleFor(requester: Requester): Promise<StaffRole> {
  const roles = await loadDirRoles();
  if (!roles) return "customer";
  const mine = new Set(requester.zammadUser.role_ids);
  return staffRoleOf(roles.filter((role) => mine.has(role.id)).map((role) => role.permissions));
}

// Quem pode receber chamados deste grupo (para o gestor alocar).
export async function assigneesFor(groupId: number): Promise<DirUser[]> {
  const [users, roles] = await Promise.all([loadDirUsers(), loadDirRoles()]);
  return users && roles ? assigneesForGroup(groupId, users, roles) : [];
}

// Os grupos que a pessoa gerencia e a equipe que responde por eles.
export async function teamFor(requester: Requester): Promise<{ groupIds: number[]; members: DirUser[] }> {
  const [users, roles] = await Promise.all([loadDirUsers(), loadDirRoles()]);
  if (!users || !roles) return { groupIds: [], members: [] };
  const me = users.find((user) => user.id === requester.zammadUser.id);
  const groupIds = me ? managedGroupIds(me, roles) : [];
  return { groupIds, members: teamOf(groupIds, users, roles) };
}
