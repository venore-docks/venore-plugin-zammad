import { resolveRequester } from "../../shared/requester";
import { getWizard } from "./service";
import type { GetWizardResult } from "./types";

export async function getWizardHandler(): Promise<GetWizardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return getWizard(requester.data);
}
