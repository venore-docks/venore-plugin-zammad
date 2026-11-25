import { resolveRequester } from "../../shared/requester";
import { getChildForm } from "./service";
import type { GetChildFormInput, GetChildFormResult } from "./types";

export async function getChildFormHandler(input: GetChildFormInput): Promise<GetChildFormResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return getChildForm(requester.data, input);
}
