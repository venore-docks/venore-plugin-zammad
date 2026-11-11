import { asPluginApiHandler, isPluginActive } from "@venore/plugin-sdk";
import { downloadAttachment } from "../../index";

// GET /api/zammad/tickets/:ticketId/articles/:articleId/attachments/:attachmentId
//
// Anexo de um chamado da pessoa logada, servido pelo próprio portal (o Zammad não é exposto). Exige
// login + permissão e confere no handler que o chamado é DELA e que o anexo está num artigo público.
// Nada de cache compartilhado: o arquivo é privado.
function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const getTicketAttachment = asPluginApiHandler<{ ticketId: string; articleId: string; attachmentId: string }>(async (_request, { params }) => {
  if (!(await isPluginActive("zammad"))) return Response.json({ error: "O plugin de chamados está desativado." }, { status: 404 });
  const { ticketId, articleId, attachmentId } = await params;
  const ids = [Number(ticketId), Number(articleId), Number(attachmentId)];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return Response.json({ error: "Arquivo inválido." }, { status: 400 });

  const result = await downloadAttachment({ ticketId: ids[0], articleId: ids[1], attachmentId: ids[2] });
  if (!result.success) {
    const status = result.error.code === "zammad.attachment_not_found" || result.error.code === "zammad.ticket_not_found" ? 404 : 403;
    return Response.json({ error: result.error.message }, { status });
  }

  const { body, contentType, filename, size, inline } = result.data;
  const headers: Record<string, string> = {
    "Content-Type": inline ? contentType : "application/octet-stream",
    "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", filename),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (size) headers["Content-Length"] = String(size);
  return new Response(body, { headers });
});
