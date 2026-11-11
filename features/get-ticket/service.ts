import type { TicketAttachmentInfo, TicketMessage } from "../../contracts/types";
import type { ZammadArticle } from "../../contracts/zammad";
import { resolveAvatars } from "../../shared/avatars";
import { articleToText, cleanSenderName, extractFormAnswers } from "../../shared/html-text";
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
  const split = isHtml ? extractFormAnswers(article.body ?? "") : { html: article.body ?? "", answers: [] };
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
    answers: split.answers,
    createdAt: article.created_at,
    attachments,
  };
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
