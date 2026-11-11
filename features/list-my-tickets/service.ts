import type { TicketSummary } from "../../contracts/types";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import type { Requester } from "../../shared/requester";
import { describeState, isAwaitingYou } from "../../shared/ticket-state";
import { zammadRequest } from "../../shared/zammad-client";
import type { ListMyTicketsResult } from "./types";

const LIMIT = 50;

export async function listMyTickets(requester: Requester): Promise<ListMyTicketsResult> {
  // Em nome da pessoa: o Zammad só devolve o que ELA pode ver; o filtro por customer_id deixa só os
  // chamados em que ela é a solicitante (agente também vê só os próprios aqui, não a fila do setor).
  const query = new URLSearchParams({
    query: `customer_id:${requester.zammadUser.id}`,
    limit: String(LIMIT),
    expand: "true",
    sort_by: "updated_at",
    order_by: "desc",
  });
  const result = await zammadRequest<ZammadExpandedTicket[]>(`tickets/search?${query.toString()}`, { onBehalfOf: requester.email });
  if (!result.success) return result;

  const tickets: TicketSummary[] = (Array.isArray(result.data) ? result.data : []).map((ticket) => {
    const state = describeState(ticket.state ?? "");
    return {
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: ticket.group,
      stateLabel: state.label,
      stateTone: state.tone,
      closed: state.closed,
      awaitingYou: isAwaitingYou(ticket, state.closed),
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  });
  return { success: true, data: { tickets } };
}
