import type { TicketStateTone, TicketSummary } from "../../contracts/types";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import type { Requester } from "../../shared/requester";
import { readConnection, ticketUrl, zammadRequest } from "../../shared/zammad-client";
import type { ListMyTicketsResult } from "./types";

const LIMIT = 50;

// Nomes padrão do Zammad em pt-BR; estado criado à mão (ex.: "em andamento") aparece como está.
const STATE_LABELS: Record<string, { label: string; tone: TicketStateTone }> = {
  new: { label: "Novo", tone: "new" },
  open: { label: "Em atendimento", tone: "open" },
  "pending reminder": { label: "Aguardando", tone: "pending" },
  "pending close": { label: "Encerrando", tone: "pending" },
  closed: { label: "Fechado", tone: "closed" },
  merged: { label: "Mesclado", tone: "closed" },
};

export function describeState(state: string): { label: string; tone: TicketStateTone } {
  const known = STATE_LABELS[state.toLowerCase()];
  if (known) return known;
  return { label: state.charAt(0).toUpperCase() + state.slice(1), tone: "open" };
}

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

  const baseUrl = readConnection()?.baseUrl ?? "";
  const tickets: TicketSummary[] = (Array.isArray(result.data) ? result.data : []).map((ticket) => {
    const state = describeState(ticket.state ?? "");
    return {
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: ticket.group,
      state: ticket.state,
      stateLabel: state.label,
      stateTone: state.tone,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      url: ticketUrl(baseUrl, ticket.id),
    };
  });
  return { success: true, data: { tickets, zammadUrl: baseUrl } };
}
