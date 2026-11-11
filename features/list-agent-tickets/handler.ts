import { resolveRequester } from "../../shared/requester";
import { listAgentTickets } from "./service";
import type { ListAgentTicketsInput, ListAgentTicketsResult } from "./types";

export async function listAgentTicketsHandler(input: ListAgentTicketsInput): Promise<ListAgentTicketsResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return listAgentTickets(requester.data, input);
}
