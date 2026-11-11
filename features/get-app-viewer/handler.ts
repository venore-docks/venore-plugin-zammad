import { canManageTicketState } from "../../shared/own-ticket";
import { resolveRequester } from "../../shared/requester";
import type { GetAppViewerResult } from "./types";

export async function getAppViewerHandler(): Promise<GetAppViewerResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return {
    success: true,
    data: { isAgent: await canManageTicketState(requester.data), name: requester.data.name ?? requester.data.email },
  };
}
