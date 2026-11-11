import { UNASSIGNED_OWNER_ID, isSupervisor } from "../../shared/access-rules";
import { staffRoleFor, teamFor } from "../../shared/directory";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { searchOpenTicketsByOwner } from "../../shared/ticket-search";
import { isCustomerWaiting } from "../../shared/ticket-state";
import type { GetTeamOverviewResult, TeamMember } from "./types";

const MAX_MEMBERS = 40;

export async function getTeamOverview(requester: Requester): Promise<GetTeamOverviewResult> {
  if (!isSupervisor(await staffRoleFor(requester))) return failure("forbidden_team", "Só o gestor vê a equipe.");
  const team = await teamFor(requester);
  const members = team.members.slice(0, MAX_MEMBERS);

  const [queue, ...perMember] = await Promise.all([
    searchOpenTicketsByOwner(requester, UNASSIGNED_OWNER_ID),
    ...members.map((member) => searchOpenTicketsByOwner(requester, member.id)),
  ]);
  if (!queue.success) return queue;

  const overview: TeamMember[] = members.map((member, index) => {
    const found = perMember[index];
    const tickets = found.success ? found.data : [];
    return { id: member.id, name: member.name, open: tickets.length, waiting: tickets.filter((ticket) => isCustomerWaiting(ticket)).length };
  });
  return { success: true, data: { members: overview, queue: queue.data.length, groupCount: team.groupIds.length } };
}
