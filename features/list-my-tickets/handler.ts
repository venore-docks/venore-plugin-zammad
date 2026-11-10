import { resolveRequester } from "../../shared/requester";
import { listMyTickets } from "./service";
import type { ListMyTicketsResult } from "./types";

export async function listMyTicketsHandler(): Promise<ListMyTicketsResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return listMyTickets(requester.data);
}
