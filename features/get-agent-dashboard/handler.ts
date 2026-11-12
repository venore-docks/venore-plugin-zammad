import { resolveRequester } from "../../shared/requester";
import { getAgentDashboard } from "./service";
import type { GetAgentDashboardResult } from "./types";

export async function getAgentDashboardHandler(): Promise<GetAgentDashboardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return getAgentDashboard(requester.data);
}
