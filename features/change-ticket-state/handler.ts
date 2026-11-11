import { resolveRequester } from "../../shared/requester";
import { changeTicketState } from "./service";
import type { ChangeTicketStateInput, ChangeTicketStateResult } from "./types";

export async function changeTicketStateHandler(input: ChangeTicketStateInput): Promise<ChangeTicketStateResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return changeTicketState(requester.data, input);
}
