import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { ZAMMAD_PERMISSIONS } from "../../shared/permissions";
import { getAdminOverview } from "./service";
import type { GetAdminOverviewResult } from "./types";

export async function getAdminOverviewHandler(): Promise<GetAdminOverviewResult> {
  const authz = await authorizeActor(ZAMMAD_PERMISSIONS.settingsManage);
  if (!authz.authorized) return { success: false, error: authz.error };
  return getAdminOverview();
}
