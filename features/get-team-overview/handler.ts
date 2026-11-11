import { resolveRequester } from "../../shared/requester";
import { getTeamOverview } from "./service";
import type { GetTeamOverviewResult } from "./types";

export async function getTeamOverviewHandler(): Promise<GetTeamOverviewResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return getTeamOverview(requester.data);
}
