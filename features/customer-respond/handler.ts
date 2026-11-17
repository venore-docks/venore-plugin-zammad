import { resolveRequester } from "../../shared/requester";
import { customerRespond } from "./service";
import type { CustomerRespondInput, CustomerRespondResult } from "./types";

export async function customerRespondHandler(input: CustomerRespondInput): Promise<CustomerRespondResult> {
  const requester = await resolveRequester({ write: true });
  if (!requester.success) return requester;
  return customerRespond(requester.data, input);
}
