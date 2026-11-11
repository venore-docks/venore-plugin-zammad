import { resolveRequester } from "../../shared/requester";
import { replyTicket } from "./service";
import type { ReplyTicketInput, ReplyTicketResult } from "./types";

export async function replyTicketHandler(input: ReplyTicketInput): Promise<ReplyTicketResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return replyTicket(requester.data, input);
}
