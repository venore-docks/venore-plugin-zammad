import { requesterIsColaboraAdmin, resolveRequester } from "../../shared/requester";
import { loadAudienceViewer } from "../../shared/wizard-config";
import { getWizard } from "./service";
import type { GetWizardResult } from "./types";

export async function getWizardHandler(): Promise<GetWizardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  const viewer = await loadAudienceViewer(requester.data.actorId, await requesterIsColaboraAdmin(requester.data));
  return getWizard(requester.data, viewer);
}
