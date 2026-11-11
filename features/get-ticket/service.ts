import type { AgentControls, TicketAttachmentInfo, TicketMessage } from "../../contracts/types";
import type { ZammadArticle, ZammadExpandedTicket } from "../../contracts/zammad";
import { canWorkTicket, type ViewerMode } from "../../shared/access-rules";
import { resolveAvatars } from "../../shared/avatars";
import { articleToText, cleanSenderName, extractFormAnswers, extractReplyQuote, makeExcerpt } from "../../shared/html-text";
import { canManageTicketState, loadAgentOptions, loadArticles, loadTicketForViewer } from "../../shared/own-ticket";
import { getPerson } from "../../shared/people";
import type { Requester } from "../../shared/requester";
import { describeState, isAwaitingYou, isCustomerWaiting } from "../../shared/ticket-state";
import { priorityLabel } from "../../shared/ticket-options";
import type { GetTicketInput, GetTicketResult } from "./types";

export function attachmentHref(ticketId: number, articleId: number, attachmentId: number): string {
  return `/api/zammad/tickets/${ticketId}/articles/${articleId}/attachments/${attachmentId}`;
}

const SAFE_IMAGE = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

type MessageContext = { requester: Requester; avatars: Map<number, string>; customerId: number; mode: ViewerMode };

function toMessage(article: ZammadArticle, context: MessageContext): TicketMessage {
  const { requester, avatars, customerId, mode } = context;
  const mine = article.created_by_id === requester.zammadUser.id;
  const system = article.sender === "System";
  const isHtml = (article.content_type ?? "").toLowerCase().includes("html");
  // Citação ("Responder") vale em qualquer mensagem escrita pelo portal: da pessoa ou do agente no app.
  const quoted = isHtml ? extractReplyQuote(article.body ?? "") : { html: article.body ?? "", quote: null };
  const split = isHtml ? extractFormAnswers(quoted.html) : { html: quoted.html, answers: [] };
  const attachments: TicketAttachmentInfo[] = (article.attachments ?? []).map((file) => {
    const mime = String(file.preferences?.["Content-Type"] ?? file.preferences?.["Mime-Type"] ?? "");
    return {
      id: file.id,
      filename: file.filename,
      size: Number(file.size) || 0,
      isImage: SAFE_IMAGE.test(mime),
      href: attachmentHref(article.ticket_id, article.id, file.id),
    };
  });
  // Na visão do agente, quem não sou eu e é o solicitante aparece como "customer"; os demais, equipe.
  const role = system ? "system" : mine ? "me" : mode === "agent" && article.created_by_id === customerId ? "customer" : "team";
  return {
    id: article.id,
    role,
    internal: Boolean(article.internal),
    authorName: mine ? "Você" : cleanSenderName(article.from) || (system ? "Sistema" : role === "customer" ? "Solicitante" : "Equipe"),
    avatarUrl: system ? null : (avatars.get(article.created_by_id) ?? null),
    text: articleToText(split.html, article.content_type ?? "text/plain"),
    quote: quoted.quote ? { ...quoted.quote, targetId: null } : null,
    answers: split.answers,
    createdAt: article.created_at,
    attachments,
  };
}

// A citação guarda autor + trecho, não o id: acha a mensagem original (anterior, cujo texto começa pelo
// trecho e cujo autor bate) para o portal poder rolar até ela. Não achou = o cartão fica sem link.
function linkQuotes(messages: TicketMessage[]): void {
  for (const message of messages) {
    if (!message.quote) continue;
    const quote = message.quote;
    const needle = quote.excerpt.replace(/…$/, "");
    const target = [...messages]
      .reverse()
      .find(
        (other) =>
          other.id < message.id &&
          (other.authorName === quote.author || other.role === "me") &&
          makeExcerpt(other.text, Number.MAX_SAFE_INTEGER).startsWith(needle),
      );
    quote.targetId = target?.id ?? null;
  }
}

async function buildAgentControls(ticket: ZammadExpandedTicket, requester: Requester, mode: ViewerMode): Promise<AgentControls | null> {
  if (mode !== "agent") return null;
  const options = await loadAgentOptions();
  return {
    canWork: canWorkTicket(mode, ticket.owner_id, requester.zammadUser.id),
    stateId: ticket.state_id,
    priorityId: ticket.priority_id,
    states: options.success ? options.data.states.map(({ id, label, tone, needsPending }) => ({ id, label, tone, needsPending })) : [],
    priorities: options.success ? options.data.priorities.map(({ id, label }) => ({ id, label })) : [],
  };
}

export async function getTicket(requester: Requester, input: GetTicketInput): Promise<GetTicketResult> {
  const viewed = await loadTicketForViewer(requester, input.ticketId, Boolean(input.asAgent));
  if (!viewed.success) return viewed;
  const { ticket, mode } = viewed.data;
  const articles = await loadArticles(requester, input.ticketId, { includeInternal: mode === "agent" });
  if (!articles.success) return articles;

  const state = describeState(ticket.state ?? "");
  const avatars = await resolveAvatars(
    requester,
    articles.data.filter((article) => article.sender !== "System").map((article) => article.created_by_id),
  ).catch(() => new Map<number, string>());
  // Mensagem de sistema (ex.: "e-mail não enviado") é ruído interno; fica de fora.
  const messages = articles.data
    .map((article) => toMessage(article, { requester, avatars, customerId: ticket.customer_id, mode }))
    .filter((message) => message.role !== "system");
  linkQuotes(messages);

  const meId = requester.zammadUser.id;
  const [requesterPerson, ownerPerson, agent, canClose] = await Promise.all([
    ticket.customer_id === meId ? Promise.resolve(null) : getPerson(ticket.customer_id),
    ticket.owner_id && ticket.owner_id !== meId ? getPerson(ticket.owner_id) : Promise.resolve(null),
    buildAgentControls(ticket, requester, mode),
    canManageTicketState(requester),
  ]);
  const unassigned = !ticket.owner_id || ticket.owner_id === 1;

  return {
    success: true,
    data: {
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: ticket.group,
      stateLabel: state.label,
      stateTone: state.tone,
      closed: state.closed,
      awaitingYou: isAwaitingYou(ticket, state.closed),
      customerWaiting: !state.closed && isCustomerWaiting(ticket),
      canClose,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      priorityLabel: priorityLabel(ticket.priority ?? ""),
      viewer: mode,
      requester:
        ticket.customer_id === meId
          ? { name: requester.name ?? requester.email, email: requester.email }
          : { name: requesterPerson?.name ?? "Solicitante", email: requesterPerson?.email ?? null },
      owner: unassigned ? null : { name: ticket.owner_id === meId ? "Você" : (ownerPerson?.name ?? "Responsável") },
      assignedToMe: ticket.owner_id === meId,
      agent,
      messages,
    },
  };
}
