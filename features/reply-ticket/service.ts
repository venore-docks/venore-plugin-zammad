import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { escapeHtml, validateAttachments, validateReply } from "../../shared/answers";
import { loadOwnTicket, resolveStateId } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { describeState } from "../../shared/ticket-state";
import { zammadRequest } from "../../shared/zammad-client";
import type { ReplyTicketInput, ReplyTicketResult } from "./types";

export async function replyTicket(requester: Requester, input: ReplyTicketInput): Promise<ReplyTicketResult> {
  const handle = beginOperation({ useCase: "zammad.reply-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: ReplyTicketResult) => {
    endOperation(handle, result);
    return result;
  };

  const messageError = validateReply(input.message);
  if (messageError) return finish(failure("invalid_reply", messageError));
  const attachmentError = validateAttachments(input.attachments);
  if (attachmentError) return finish(failure("invalid_attachments", attachmentError));

  const ticket = await loadOwnTicket(requester, input.ticketId);
  if (!ticket.success) return finish(ticket);

  const body = input.message
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
  const created = await zammadRequest<{ id: number }>("ticket_articles", {
    method: "POST",
    onBehalfOf: requester.email,
    timeoutMs: 45000,
    body: {
      ticket_id: ticket.data.id,
      subject: `Re: ${ticket.data.title}`.slice(0, 200),
      body,
      content_type: "text/html",
      type: "web",
      sender: "Customer",
      internal: false,
      attachments: input.attachments.map((file) => ({
        filename: file.filename,
        data: file.base64,
        "mime-type": file.mimeType || "application/octet-stream",
      })),
    },
  });
  if (!created.success) return finish(created);

  // Resposta em chamado encerrado = a pessoa quer reabrir. O Zammad só deixa cliente usar o estado
  // "new"; se falhar, a mensagem já foi enviada (a equipe é avisada do mesmo jeito) — não é erro.
  let reopened = false;
  if (describeState(ticket.data.state ?? "").closed) {
    const stateId = await resolveStateId("new");
    if (stateId.success) {
      const updated = await zammadRequest(`tickets/${ticket.data.id}`, {
        method: "PUT",
        onBehalfOf: requester.email,
        body: { state_id: stateId.data },
      });
      reopened = updated.success;
    }
  }
  return finish({ success: true, data: { reopened } });
}
