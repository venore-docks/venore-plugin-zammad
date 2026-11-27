import type { TicketSummary } from "../../contracts/types";
import { formatGroupName } from "../../shared/format";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { customerMustDecide } from "../../shared/flow";
import { articleVisibleText, makeExcerpt } from "../../shared/html-text";
import { loadPublicArticles } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { priorityLabel } from "../../shared/ticket-options";
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

  const found = Array.isArray(result.data) ? result.data : [];
  // A pergunta da equipe só dos chamados que esperam a resposta (poucos): uma leitura de artigos por chamado.
  const waiting = found.filter((ticket) => describeState(ticket.state ?? "").step === "aguardando_solicitante").slice(0, 10);
  const questions = new Map<number, string>();
  await Promise.all(
    waiting.map(async (ticket) => {
      const articles = await loadPublicArticles(requester, ticket.id);
      if (!articles.success) return;
      const last = [...articles.data].reverse().find((article) => article.sender === "Agent");
      const text = last ? makeExcerpt(articleVisibleText(last.body ?? "", last.content_type ?? "text/plain"), 160) : "";
      if (text) questions.set(ticket.id, text);
    }),
  );

  const tickets: TicketSummary[] = found.map((ticket) => {
    const state = describeState(ticket.state ?? "");
    return {
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: formatGroupName(ticket.group),
      stateLabel: state.label,
      stateTone: state.tone,
      stateColor: state.color,
      closed: state.closed,
      // Concluído / Não autorizado esperam a decisão de quem abriu (fluxo da FEM).
      awaitingYou: isAwaitingYou(ticket, state.closed) || customerMustDecide(state.step),
      question: questions.get(ticket.id) ?? null,
      priorityLabel: priorityLabel(ticket.priority ?? ""),
      requesterName: null,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  });
  return { success: true, data: { tickets } };
}
