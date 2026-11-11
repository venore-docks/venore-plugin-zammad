import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadArticle, ZammadExpandedTicket, ZammadTicketPriority, ZammadTicketState } from "../contracts/zammad";
import { viewerMode, type ViewerMode } from "./access-rules";
import type { Requester } from "./requester";
import { buildPriorityOptions, buildStateOptions, type PriorityOption, type StateOption } from "./ticket-options";
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

// Um chamado para quem está olhando, na visão pedida:
//   asAgent=false (portal): só o que a pessoa abriu — como sempre.
//   asAgent=true  (app): agente vê os atribuídos a ele e a fila; solicitante vê os dele.
// Devolve também em que modo a pessoa está vendo (decide o que a tela mostra e o que o servidor deixa
// fazer). 404 igual para "não existe" e "não é seu".
export type ViewedTicket = { ticket: ZammadExpandedTicket; mode: ViewerMode; isAgent: boolean };

export async function loadTicketForViewer(requester: Requester, ticketId: number, asAgent: boolean): Promise<OperationResult<ViewedTicket>> {
  if (!Number.isInteger(ticketId) || ticketId <= 0) return failure("ticket_not_found", NOT_FOUND);
  const result = await zammadRequest<ZammadExpandedTicket>(`tickets/${ticketId}?expand=true`, { onBehalfOf: requester.email });
  if (!result.success) {
    return result.error.code === "zammad.request_failed" || result.error.code === "zammad.forbidden"
      ? failure("ticket_not_found", NOT_FOUND)
      : result;
  }
  const isAgent = asAgent ? await canManageTicketState(requester) : false;
  const mode = viewerMode({
    customerId: result.data.customer_id,
    ownerId: result.data.owner_id,
    meId: requester.zammadUser.id,
    isAgent,
    asAgent,
  });
  if (!mode) return failure("ticket_not_found", NOT_FOUND);
  return { success: true, data: { ticket: result.data, mode, isAgent } };
}

// Artigos do chamado, do mais antigo ao mais novo. Nota interna da equipe só vem quando pedida
// (`includeInternal`, visão do agente): o Zammad já a esconde de cliente, mas um agente em nome próprio
// receberia tudo, então o filtro também é nosso.
export async function loadArticles(
  requester: Requester,
  ticketId: number,
  options: { includeInternal?: boolean } = {},
): Promise<OperationResult<ZammadArticle[]>> {
  const result = await zammadRequest<ZammadArticle[]>(`ticket_articles/by_ticket/${ticketId}?expand=true`, { onBehalfOf: requester.email });
  if (!result.success) return result;
  const articles = (Array.isArray(result.data) ? result.data : []).filter((article) => options.includeInternal || !article.internal);
  return { success: true, data: articles.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) };
}

// Só artigos públicos: nota interna da equipe nunca chega à pessoa.
export async function loadPublicArticles(requester: Requester, ticketId: number): Promise<OperationResult<ZammadArticle[]>> {
  return loadArticles(requester, ticketId);
}

let prioritiesCache: { at: number; priorities: ZammadTicketPriority[] } | null = null;

// Estados e prioridades que o agente pode escolher (dados do Zammad, em cache de 10 min).
export async function loadAgentOptions(): Promise<OperationResult<{ states: StateOption[]; priorities: PriorityOption[] }>> {
  const states = await loadStates();
  if (!states.success) return states;
  if (!prioritiesCache || Date.now() - prioritiesCache.at > 10 * 60 * 1000) {
    const result = await zammadRequest<ZammadTicketPriority[]>("ticket_priorities");
    if (!result.success) return result;
    prioritiesCache = { at: Date.now(), priorities: result.data };
  }
  return { success: true, data: { states: buildStateOptions(states.data), priorities: buildPriorityOptions(prioritiesCache.priorities) } };
}

let statesCache: { at: number; states: ZammadTicketState[] } | null = null;

async function loadStates(): Promise<OperationResult<ZammadTicketState[]>> {
  if (statesCache && Date.now() - statesCache.at < 10 * 60 * 1000) return { success: true, data: statesCache.states };
  const result = await zammadRequest<ZammadTicketState[]>("ticket_states");
  if (!result.success) return result;
  statesCache = { at: Date.now(), states: result.data };
  return result;
}

type ZammadRole = { id: number; name: string; permissions?: string[] };
let rolesCache: { at: number; roles: ZammadRole[] } | null = null;

// Encerrar/reabrir chamado é da EQUIPE: papel com `ticket.agent` ou `admin` no Zammad. Colaborador
// comum (papel "Clientes") só conversa. Se a lista de papéis não carregar, nega (falha segura).
export async function canManageTicketState(requester: Requester): Promise<boolean> {
  if (!rolesCache || Date.now() - rolesCache.at > 10 * 60 * 1000) {
    const result = await zammadRequest<ZammadRole[]>("roles?expand=true");
    if (!result.success) return false;
    rolesCache = { at: Date.now(), roles: Array.isArray(result.data) ? result.data : [] };
  }
  const mine = new Set(requester.zammadUser.role_ids);
  return rolesCache.roles.some(
    (role) => mine.has(role.id) && (role.permissions ?? []).some((permission) => permission === "ticket.agent" || permission === "admin"),
  );
}

// Estados que a pessoa pode pedir: o Zammad só deixa cliente usar "new" e "closed".
export async function resolveStateId(name: "new" | "closed"): Promise<OperationResult<number>> {
  const states = await loadStates();
  if (!states.success) return states;
  const state = states.data.find((candidate) => candidate.name === name && candidate.active);
  return state ? { success: true, data: state.id } : failure("state_missing", `O Zammad não tem o estado "${name}".`);
}
