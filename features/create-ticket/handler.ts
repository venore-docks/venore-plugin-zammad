import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { COLABORA_PERMISSIONS } from "../../shared/permissions";
import { resolveRequester } from "../../shared/requester";
import { loadAudienceViewer } from "../../shared/wizard-config";
import { createTicket } from "./service";
import type { CreateTicketInput, CreateTicketResult } from "./types";

export async function createTicketHandler(input: CreateTicketInput): Promise<CreateTicketResult> {
  const requester = await resolveRequester({ write: true });
  if (!requester.success) return requester;
  const admin = await authorizeActor(COLABORA_PERMISSIONS.settingsManage);
  const viewer = await loadAudienceViewer(requester.data.actorId, admin.authorized);
  return createTicket(requester.data, input, viewer);
}
