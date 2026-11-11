import type { TicketAttachmentInfo, TicketMessage } from "../../contracts/types";
import type { ZammadArticle } from "../../contracts/zammad";
import { articleToText, cleanSenderName } from "../../shared/html-text";
import { loadOwnTicket, loadPublicArticles } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { describeState, isAwaitingYou } from "../../shared/ticket-state";
import type { GetTicketInput, GetTicketResult } from "./types";

export function attachmentHref(ticketId: number, articleId: number, attachmentId: number): string {
  return `/api/zammad/tickets/${ticketId}/articles/${articleId}/attachments/${attachmentId}`;
}

const SAFE_IMAGE = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

function toMessage(article: ZammadArticle, requester: Requester): TicketMessage {
  const mine = article.created_by_id === requester.zammadUser.id;
  const system = article.sender === "System";
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
    text: articleToText(article.body ?? "", article.content_type ?? "text/plain"),
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
  const messages = articles.data.map((article) => toMessage(article, requester)).filter((message) => message.role !== "system");
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
      createdAt: ticket.data.created_at,
      updatedAt: ticket.data.updated_at,
      messages,
    },
  };
}
