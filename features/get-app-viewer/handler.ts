import { isStaff, isSupervisor } from "../../shared/access-rules";
import { staffRoleFor } from "../../shared/directory";
import { resolveRequester } from "../../shared/requester";
import type { GetAppViewerResult } from "./types";

export async function getAppViewerHandler(): Promise<GetAppViewerResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  const role = await staffRoleFor(requester.data);
  const name = requester.data.name ?? requester.data.email;
  return {
    success: true,
    data: {
      role,
      isStaff: isStaff(role),
      isSupervisor: isSupervisor(role),
      name,
      viewingAs: requester.data.viewAs ? { name, email: requester.data.email } : null,
    },
  };
}
