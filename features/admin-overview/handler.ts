import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { COLABORA_PERMISSIONS } from "../../shared/permissions";
import { getAdminOverview } from "./service";
import type { AdminOverviewInput, GetAdminOverviewResult } from "./types";

export async function getAdminOverviewHandler(input: AdminOverviewInput = {}): Promise<GetAdminOverviewResult> {
  const authz = await authorizeActor(COLABORA_PERMISSIONS.settingsManage);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getAdminOverview(input);
}
