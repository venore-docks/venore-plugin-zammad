import { requesterIsColaboraAdmin, resolveRequester } from "../../shared/requester";
import { loadAudienceViewer } from "../../shared/wizard-config";
import { createTicket } from "./service";
import type { CreateTicketInput, CreateTicketResult } from "./types";

export async function createTicketHandler(input: CreateTicketInput): Promise<CreateTicketResult> {
  const requester = await resolveRequester({ write: true });
  if (!requester.success) return requester;
  const viewer = await loadAudienceViewer(requester.data.actorId, await requesterIsColaboraAdmin(requester.data));
  return createTicket(requester.data, input, viewer);
}
