import { isStaff, isSupervisor } from "../../shared/access-rules";
import { staffRoleFor } from "../../shared/directory";
import { resolveRequester } from "../../shared/requester";
import type { GetAppViewerResult } from "./types";

export async function getAppViewerHandler(): Promise<GetAppViewerResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  const role = await staffRoleFor(requester.data);
  return {
    success: true,
    data: { role, isStaff: isStaff(role), isSupervisor: isSupervisor(role), name: requester.data.name ?? requester.data.email },
  };
}
