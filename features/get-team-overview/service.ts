import { isSupervisor } from "../../shared/access-rules";
import { staffRoleFor, teamFor } from "../../shared/directory";
import { loadManagerSnapshot } from "../../shared/manager-snapshot";
import { formatGroupName } from "../../shared/format";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { loadSchema } from "../../shared/schema";
import { isAwaitingDecision, isAwaitingRequester, isCustomerWaiting, isOpenTicket } from "../../shared/ticket-state";
import type { GetTeamOverviewResult, TeamGroup, TeamMember } from "./types";

export async function getTeamOverview(requester: Requester): Promise<GetTeamOverviewResult> {
  if (!isSupervisor(await staffRoleFor(requester))) return failure("forbidden_team", "Só o gestor vê a equipe.");
  const [team, schema] = await Promise.all([teamFor(requester), loadSchema()]);
  // A mesma leitura da Fila e do Início do gestor (em cache): não refaz as N+1 buscas no Zammad.
  const snapshot = await loadManagerSnapshot(requester);
  if (!snapshot.success) return snapshot;
  const { members, unassigned, perMember } = snapshot.data;
  const overview: TeamMember[] = members.map((member, index) => {
    const tickets = (perMember[index] ?? []).filter(isOpenTicket);
    return {
      id: member.id,
      name: member.name,
      open: tickets.length,
      waiting: tickets.filter((ticket) => isCustomerWaiting(ticket)).length,
      awaitingRequester: tickets.filter((ticket) => isAwaitingRequester(ticket)).length,
      groupIds: team.memberGroups[member.id] ?? [],
    };
  });

  // Só os setores que alguém da equipe atende; o nome vem do cadastro de grupos (falha de leitura = "Setor #id").
  const names = new Map<number, string>();
  if (schema.success) for (const group of schema.data.groups) names.set(group.id, formatGroupName(group.name));
  const used = new Set(overview.flatMap((member) => member.groupIds));
  const groups: TeamGroup[] = team.groupIds
    .filter((id) => used.has(id))
    .map((id) => ({ id, name: names.get(id) ?? `Setor #${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { success: true, data: { members: overview, queue: unassigned.filter((ticket) => isOpenTicket(ticket) && isAwaitingDecision(ticket)).length, groupCount: team.groupIds.length, groups } };
}
