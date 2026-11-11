import type { TicketSummary } from "../../contracts/types";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { UNASSIGNED_OWNER_ID, canSeeQueue, isStaff, isSupervisor } from "../../shared/access-rules";
import { staffRoleFor, teamFor } from "../../shared/directory";
import { getPeople } from "../../shared/people";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { priorityLabel } from "../../shared/ticket-options";
import { searchOpenTicketsByOwner } from "../../shared/ticket-search";
import { describeState, isCustomerWaiting } from "../../shared/ticket-state";
import type { ListAgentTicketsInput, ListAgentTicketsResult } from "./types";

export async function listAgentTickets(requester: Requester, input: ListAgentTicketsInput): Promise<ListAgentTicketsResult> {
  const role = await staffRoleFor(requester);
  if (!isStaff(role)) return failure("not_agent", "Esta área é só para a equipe de atendimento.");

  let ownerId: number;
  if (input.kind === "assigned") {
    ownerId = requester.zammadUser.id;
  } else if (input.kind === "queue") {
    // A fila (sem responsável) é do gestor/admin: é de lá que ele aloca; o agente comum só vê o que lhe foi atribuído.
    if (!canSeeQueue(role)) return failure("forbidden_queue", "A fila de chamados sem responsável é do gestor.");
    ownerId = UNASSIGNED_OWNER_ID;
  } else {
    if (!isSupervisor(role)) return failure("forbidden_team", "Só o gestor vê os chamados da equipe.");
    const team = await teamFor(requester);
    if (!team.members.some((member) => member.id === input.agentId)) return failure("not_in_team", "Esta pessoa não está na sua equipe.");
    ownerId = input.agentId;
  }

  const found = await searchOpenTicketsByOwner(requester, ownerId);
  if (!found.success) return found;
  return { success: true, data: { tickets: await toSummaries(found.data) } };
}

async function toSummaries(tickets: ZammadExpandedTicket[]): Promise<TicketSummary[]> {
  const people = await getPeople(tickets.map((ticket) => ticket.customer_id));
  return tickets.map((ticket) => {
    const state = describeState(ticket.state ?? "");
    return {
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: ticket.group,
      stateLabel: state.label,
      stateTone: state.tone,
      closed: false,
      // Para quem atende: o solicitante falou por último (o chamado espera resposta dele).
      awaitingYou: isCustomerWaiting(ticket),
      priorityLabel: priorityLabel(ticket.priority ?? ""),
      requesterName: people.get(ticket.customer_id)?.name ?? null,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  });
}
