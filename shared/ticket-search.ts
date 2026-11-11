import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadExpandedTicket } from "../contracts/zammad";
import type { Requester } from "./requester";
import { describeState } from "./ticket-state";
import { zammadRequest } from "./zammad-client";

const LIMIT = 100;

// Chamados ABERTOS (não encerrados) de um responsável, do mais recente ao mais antigo. Em nome da pessoa
// que pergunta: o Zammad só devolve o que os grupos dela permitem. `ownerId` 1 = sem responsável (fila).
export async function searchOpenTicketsByOwner(requester: Requester, ownerId: number): Promise<OperationResult<ZammadExpandedTicket[]>> {
  const query = new URLSearchParams({
    query: `owner_id:${ownerId}`,
    limit: String(LIMIT),
    expand: "true",
    sort_by: "updated_at",
    order_by: "desc",
  });
  const result = await zammadRequest<ZammadExpandedTicket[]>(`tickets/search?${query.toString()}`, { onBehalfOf: requester.email });
  if (!result.success) return result;
  const open = (Array.isArray(result.data) ? result.data : []).filter((ticket) => !describeState(ticket.state ?? "").closed);
  return { success: true, data: open };
}
