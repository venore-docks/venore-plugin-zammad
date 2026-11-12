import { UNASSIGNED_OWNER_ID, isSupervisor } from "../../shared/access-rules";
import { staffRoleFor, teamFor } from "../../shared/directory";
import { shortGroupName } from "../../shared/manager-stats";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { loadSchema } from "../../shared/schema";
import { searchOpenTicketsByOwner } from "../../shared/ticket-search";
import { isCustomerWaiting } from "../../shared/ticket-state";
import type { GetTeamOverviewResult, TeamGroup, TeamMember } from "./types";

const MAX_MEMBERS = 40;

export async function getTeamOverview(requester: Requester): Promise<GetTeamOverviewResult> {
  if (!isSupervisor(await staffRoleFor(requester))) return failure("forbidden_team", "Só o gestor vê a equipe.");
  const [team, schema] = await Promise.all([teamFor(requester), loadSchema()]);
  const members = team.members.slice(0, MAX_MEMBERS);

  const [queue, ...perMember] = await Promise.all([
    searchOpenTicketsByOwner(requester, UNASSIGNED_OWNER_ID),
    ...members.map((member) => searchOpenTicketsByOwner(requester, member.id)),
  ]);
  if (!queue.success) return queue;

  const overview: TeamMember[] = members.map((member, index) => {
    const found = perMember[index];
    const tickets = found.success ? found.data : [];
    return {
      id: member.id,
      name: member.name,
      open: tickets.length,
      waiting: tickets.filter((ticket) => isCustomerWaiting(ticket)).length,
      groupIds: team.memberGroups[member.id] ?? [],
    };
  });

  // Só os setores que alguém da equipe atende; o nome vem do cadastro de grupos (falha de leitura = "Setor #id").
  const names = new Map<number, string>();
  if (schema.success) for (const group of schema.data.groups) names.set(group.id, shortGroupName(group.name));
  const used = new Set(overview.flatMap((member) => member.groupIds));
  const groups: TeamGroup[] = team.groupIds
    .filter((id) => used.has(id))
    .map((id) => ({ id, name: names.get(id) ?? `Setor #${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { success: true, data: { members: overview, queue: queue.data.length, groupCount: team.groupIds.length, groups } };
}
