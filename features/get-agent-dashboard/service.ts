import { computeAgentStats, splitForDashboard } from "../../shared/agent-stats";
import type { Requester } from "../../shared/requester";
import { listAgentTickets } from "../list-agent-tickets/service";
import type { GetAgentDashboardResult } from "./types";

export async function getAgentDashboard(requester: Requester, now: Date = new Date()): Promise<GetAgentDashboardResult> {
  // listAgentTickets exige papel de equipe e lê só os chamados atribuídos à própria pessoa.
  const assigned = await listAgentTickets(requester, { kind: "assigned" });
  if (!assigned.success) return assigned;
  const tickets = assigned.data.tickets;
  return { success: true, data: { stats: computeAgentStats(tickets, now), ...splitForDashboard(tickets, 5) } };
}
