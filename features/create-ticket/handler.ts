import { resolveRequester } from "../../shared/requester";
import { createTicket } from "./service";
import type { CreateTicketInput, CreateTicketResult } from "./types";

export async function createTicketHandler(input: CreateTicketInput): Promise<CreateTicketResult> {
  const requester = await resolveRequester({ write: true });
  if (!requester.success) return requester;
  return createTicket(requester.data, input);
}
