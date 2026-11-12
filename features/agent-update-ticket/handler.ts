import { resolveRequester } from "../../shared/requester";
import { agentUpdateTicket } from "./service";
import type { AgentUpdateInput, AgentUpdateResult } from "./types";

export async function agentUpdateTicketHandler(input: AgentUpdateInput): Promise<AgentUpdateResult> {
  const requester = await resolveRequester({ write: true });
  if (!requester.success) return requester;
  return agentUpdateTicket(requester.data, input);
}
