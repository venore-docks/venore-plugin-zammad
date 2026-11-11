import { resolveRequester } from "../../shared/requester";
import { getTicket } from "./service";
import type { GetTicketInput, GetTicketResult } from "./types";

export async function getTicketHandler(input: GetTicketInput): Promise<GetTicketResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return getTicket(requester.data, input);
}
