import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadArticle, ZammadExpandedTicket, ZammadTicketState } from "../contracts/zammad";
import type { Requester } from "./requester";
import { failure } from "./results";
import { zammadRequest } from "./zammad-client";

// Acesso a UM chamado da pessoa. Regra de ouro: só o que a própria pessoa abriu (customer_id dela).
// O X-On-Behalf-Of já limita ao que o Zammad deixa ela ver, mas um agente enxerga chamados da fila do
// setor — aqui, no portal, só mostramos/alteramos os dela. 404 igual para "não existe" e "não é seu",
// para não revelar a existência de chamados alheios.
const NOT_FOUND = "Chamado não encontrado.";

export async function loadOwnTicket(requester: Requester, ticketId: number): Promise<OperationResult<ZammadExpandedTicket>> {
  if (!Number.isInteger(ticketId) || ticketId <= 0) return failure("ticket_not_found", NOT_FOUND);
  const result = await zammadRequest<ZammadExpandedTicket>(`tickets/${ticketId}?expand=true`, { onBehalfOf: requester.email });
  if (!result.success) {
    return result.error.code === "zammad.request_failed" || result.error.code === "zammad.forbidden"
      ? failure("ticket_not_found", NOT_FOUND)
      : result;
  }
  if (result.data.customer_id !== requester.zammadUser.id) return failure("ticket_not_found", NOT_FOUND);
  return result;
}

// Só artigos públicos: nota interna da equipe nunca chega à pessoa (o Zammad já filtra para cliente,
// mas um agente em nome próprio receberia tudo).
export async function loadPublicArticles(requester: Requester, ticketId: number): Promise<OperationResult<ZammadArticle[]>> {
  const result = await zammadRequest<ZammadArticle[]>(`ticket_articles/by_ticket/${ticketId}?expand=true`, { onBehalfOf: requester.email });
  if (!result.success) return result;
  const articles = (Array.isArray(result.data) ? result.data : []).filter((article) => !article.internal);
  return { success: true, data: articles.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) };
}

let statesCache: { at: number; states: ZammadTicketState[] } | null = null;

async function loadStates(): Promise<OperationResult<ZammadTicketState[]>> {
  if (statesCache && Date.now() - statesCache.at < 10 * 60 * 1000) return { success: true, data: statesCache.states };
  const result = await zammadRequest<ZammadTicketState[]>("ticket_states");
  if (!result.success) return result;
  statesCache = { at: Date.now(), states: result.data };
  return result;
}

// Estados que a pessoa pode pedir: o Zammad só deixa cliente usar "new" e "closed".
export async function resolveStateId(name: "new" | "closed"): Promise<OperationResult<number>> {
  const states = await loadStates();
  if (!states.success) return states;
  const state = states.data.find((candidate) => candidate.name === name && candidate.active);
  return state ? { success: true, data: state.id } : failure("state_missing", `O Zammad não tem o estado "${name}".`);
}
