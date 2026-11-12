import { resolveRequester } from "../../shared/requester";
import { getCustomerDashboard } from "./service";
import type { GetCustomerDashboardResult } from "./types";

export async function getCustomerDashboardHandler(): Promise<GetCustomerDashboardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return getCustomerDashboard(requester.data);
}
