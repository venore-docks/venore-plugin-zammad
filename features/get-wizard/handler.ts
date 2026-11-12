import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { COLABORA_PERMISSIONS } from "../../shared/permissions";
import { resolveRequester } from "../../shared/requester";
import { loadAudienceViewer } from "../../shared/wizard-config";
import { getWizard } from "./service";
import type { GetWizardResult } from "./types";

export async function getWizardHandler(): Promise<GetWizardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  const admin = await authorizeActor(COLABORA_PERMISSIONS.settingsManage);
  const viewer = await loadAudienceViewer(requester.data.actorId, admin.authorized);
  return getWizard(requester.data, viewer);
}
