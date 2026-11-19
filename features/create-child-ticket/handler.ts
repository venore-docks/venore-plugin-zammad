import { resolveRequester } from "../../shared/requester";
import { createChildTicket } from "./service";
import type { CreateChildTicketInput, CreateChildTicketResult } from "./types";

export async function createChildTicketHandler(input: CreateChildTicketInput): Promise<CreateChildTicketResult> {
  const requester = await resolveRequester({ write: true });
  if (!requester.success) return requester;
  return createChildTicket(requester.data, input);
}
