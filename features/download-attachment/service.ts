import { loadOwnTicket, loadPublicArticles } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { zammadFetchRaw } from "../../shared/zammad-client";
import type { DownloadAttachmentInput, DownloadAttachmentResult } from "./types";

const INLINE_IMAGE = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

export async function downloadAttachment(requester: Requester, input: DownloadAttachmentInput): Promise<DownloadAttachmentResult> {
  const ticket = await loadOwnTicket(requester, input.ticketId);
  if (!ticket.success) return ticket;
  // O anexo precisa estar em um artigo PÚBLICO deste chamado: nunca confiamos nos ids da URL.
  const articles = await loadPublicArticles(requester, input.ticketId);
  if (!articles.success) return articles;
  const file = articles.data.find((article) => article.id === input.articleId)?.attachments?.find((attachment) => attachment.id === input.attachmentId);
  if (!file) return failure("attachment_not_found", "Arquivo não encontrado.");

  const raw = await zammadFetchRaw(`ticket_attachment/${input.ticketId}/${input.articleId}/${input.attachmentId}`, { onBehalfOf: requester.email });
  if (!raw.success) return raw;
  const contentType = raw.data.headers.get("content-type") ?? "application/octet-stream";
  const length = Number(raw.data.headers.get("content-length"));
  return {
    success: true,
    data: {
      body: raw.data.body,
      contentType,
      filename: file.filename,
      size: Number.isFinite(length) && length > 0 ? length : null,
      // Só imagens "seguras" abrem no navegador; todo o resto baixa (SVG/HTML nunca rodam no domínio do portal).
      inline: INLINE_IMAGE.test(contentType.split(";")[0].trim()),
    },
  };
}
