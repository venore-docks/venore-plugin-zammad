import type { TicketSummary } from "../../contracts/types";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { UNASSIGNED_OWNER_ID } from "../../shared/access-rules";
import { canManageTicketState } from "../../shared/own-ticket";
import { getPeople } from "../../shared/people";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { priorityLabel } from "../../shared/ticket-options";
import { describeState, isCustomerWaiting } from "../../shared/ticket-state";
import { zammadRequest } from "../../shared/zammad-client";
import type { ListAgentTicketsInput, ListAgentTicketsResult } from "./types";

const LIMIT = 100;

export async function listAgentTickets(requester: Requester, input: ListAgentTicketsInput): Promise<ListAgentTicketsResult> {
  if (!(await canManageTicketState(requester))) {
    return failure("not_agent", "Esta área é só para agentes do Zammad.");
  }
  const ownerId = input.kind === "assigned" ? requester.zammadUser.id : UNASSIGNED_OWNER_ID;
  const query = new URLSearchParams({
    query: `owner_id:${ownerId}`,
    limit: String(LIMIT),
    expand: "true",
    sort_by: "updated_at",
    order_by: "desc",
  });
  // Em nome do agente: o Zammad só devolve o que os grupos dele permitem (a fila é a dos setores dele).
  const result = await zammadRequest<ZammadExpandedTicket[]>(`tickets/search?${query.toString()}`, { onBehalfOf: requester.email });
  if (!result.success) return result;

  const open = (Array.isArray(result.data) ? result.data : []).filter((ticket) => !describeState(ticket.state ?? "").closed);
  const people = await getPeople(open.map((ticket) => ticket.customer_id));
  const tickets: TicketSummary[] = open.map((ticket) => {
    const state = describeState(ticket.state ?? "");
    return {
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: ticket.group,
      stateLabel: state.label,
      stateTone: state.tone,
      closed: false,
      // Para o agente: o solicitante falou por último (o chamado espera resposta DELE).
      awaitingYou: isCustomerWaiting(ticket),
      priorityLabel: priorityLabel(ticket.priority ?? ""),
      requesterName: people.get(ticket.customer_id)?.name ?? null,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  });
  return { success: true, data: { tickets } };
}
