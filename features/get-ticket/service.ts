import type { TicketAttachmentInfo, TicketMessage } from "../../contracts/types";
import type { ZammadArticle } from "../../contracts/zammad";
import { resolveAvatars } from "../../shared/avatars";
import { articleToText, cleanSenderName, extractFormAnswers, extractReplyQuote, makeExcerpt } from "../../shared/html-text";
import { canManageTicketState, loadOwnTicket, loadPublicArticles } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { describeState, isAwaitingYou } from "../../shared/ticket-state";
import type { GetTicketInput, GetTicketResult } from "./types";

export function attachmentHref(ticketId: number, articleId: number, attachmentId: number): string {
  return `/api/zammad/tickets/${ticketId}/articles/${articleId}/attachments/${attachmentId}`;
}

const SAFE_IMAGE = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

function toMessage(article: ZammadArticle, requester: Requester, avatars: Map<number, string>): TicketMessage {
  const mine = article.created_by_id === requester.zammadUser.id;
  const system = article.sender === "System";
  const isHtml = (article.content_type ?? "").toLowerCase().includes("html");
  // Citação ("Responder") só vale em mensagem DA PESSOA: é ela quem a envia pelo portal.
  const quoted = isHtml && mine ? extractReplyQuote(article.body ?? "") : { html: article.body ?? "", quote: null };
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
  return {
    id: article.id,
    role: system ? "system" : mine ? "me" : "team",
    authorName: mine ? "Você" : cleanSenderName(article.from) || (system ? "Sistema" : "Equipe"),
    avatarUrl: system ? null : (avatars.get(article.created_by_id) ?? null),
    text: articleToText(split.html, article.content_type ?? "text/plain"),
    quote: quoted.quote ? { ...quoted.quote, targetId: null } : null,
    answers: split.answers,
    createdAt: article.created_at,
    attachments,
  };
}

// A citação guarda autor + trecho, não o id: acha a mensagem original (anterior, do mesmo autor, cujo
// texto começa pelo trecho) para o portal poder rolar até ela. Não achou = o cartão fica sem link.
function linkQuotes(messages: TicketMessage[]): void {
  for (const message of messages) {
    if (!message.quote) continue;
    const quote = message.quote;
    const needle = quote.excerpt.replace(/…$/, "");
    const target = [...messages]
      .reverse()
      .find((other) => other.id < message.id && other.role !== "me" && other.authorName === quote.author && makeExcerpt(other.text, Number.MAX_SAFE_INTEGER).startsWith(needle));
    quote.targetId = target?.id ?? null;
  }
}

export async function getTicket(requester: Requester, input: GetTicketInput): Promise<GetTicketResult> {
  const ticket = await loadOwnTicket(requester, input.ticketId);
  if (!ticket.success) return ticket;
  const articles = await loadPublicArticles(requester, input.ticketId);
  if (!articles.success) return articles;

  const state = describeState(ticket.data.state ?? "");
  // Mensagem de sistema (ex.: "e-mail não enviado") é ruído interno; fica de fora.
  const avatars = await resolveAvatars(
    requester,
    articles.data.filter((article) => article.sender !== "System").map((article) => article.created_by_id),
  ).catch(() => new Map<number, string>());
  const messages = articles.data.map((article) => toMessage(article, requester, avatars)).filter((message) => message.role !== "system");
  linkQuotes(messages);
  return {
    success: true,
    data: {
      id: ticket.data.id,
      number: String(ticket.data.number),
      title: ticket.data.title,
      group: ticket.data.group,
      stateLabel: state.label,
      stateTone: state.tone,
      closed: state.closed,
      awaitingYou: isAwaitingYou(ticket.data, state.closed),
      canClose: await canManageTicketState(requester),
      createdAt: ticket.data.created_at,
      updatedAt: ticket.data.updated_at,
      messages,
    },
  };
}
