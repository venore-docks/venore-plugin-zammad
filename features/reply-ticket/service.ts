import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { canWorkTicket } from "../../shared/access-rules";
import { composeReplyBody, validateAttachments, validateReply } from "../../shared/answers";
import { articleVisibleText, cleanSenderName, makeExcerpt } from "../../shared/html-text";
import { loadArticles, loadTicketForViewer, resolveStateId } from "../../shared/own-ticket";
import { getPerson } from "../../shared/people";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { describeState } from "../../shared/ticket-state";
import { zammadRequest } from "../../shared/zammad-client";
import type { ReplyTicketInput, ReplyTicketResult } from "./types";

export async function replyTicket(requester: Requester, input: ReplyTicketInput): Promise<ReplyTicketResult> {
  const handle = beginOperation({ useCase: "colabora.reply-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: ReplyTicketResult) => {
    endOperation(handle, result);
    return result;
  };

  const messageError = validateReply(input.message);
  if (messageError) return finish(failure("invalid_reply", messageError));
  const attachmentError = validateAttachments(input.attachments);
  if (attachmentError) return finish(failure("invalid_attachments", attachmentError));

  const viewed = await loadTicketForViewer(requester, input.ticketId, Boolean(input.asAgent));
  if (!viewed.success) return finish(viewed);
  const { ticket, mode } = viewed.data;
  const meId = requester.zammadUser.id;
  const agentMode = mode === "agent";
  if (agentMode && !canWorkTicket(mode, ticket.owner_id, meId)) {
    return finish(failure("not_owner", "Assuma o chamado para responder."));
  }
  // Nota interna é só do agente: no modo solicitante o campo é ignorado (nunca vira nota).
  const internal = agentMode && Boolean(input.internal);

  let quote: { author: string; excerpt: string } | null = null;
  if (input.quoteArticleId) {
    const articles = await loadArticles(requester, ticket.id, { includeInternal: agentMode });
    if (!articles.success) return finish(articles);
    const target = articles.data.find((article) => article.id === input.quoteArticleId && article.sender !== "System");
    if (!target) return finish(failure("quote_not_found", "A mensagem que você quer responder não foi encontrada."));
    // Resposta PÚBLICA não pode citar nota interna: o trecho iria por e-mail ao solicitante.
    if (target.internal && !internal) return finish(failure("quote_internal", "Notas internas só podem ser citadas em outra nota interna."));
    const mine = target.created_by_id === meId;
    quote = {
      author: mine ? (requester.name ?? "Você") : cleanSenderName(target.from) || "Equipe",
      excerpt: makeExcerpt(articleVisibleText(target.body ?? "", target.content_type ?? "text/plain")) || "(anexo)",
    };
  }

  const attachments = input.attachments.map((file) => ({
    filename: file.filename,
    data: file.base64,
    "mime-type": file.mimeType || "application/octet-stream",
  }));
  const common = {
    ticket_id: ticket.id,
    subject: `Re: ${ticket.title}`.slice(0, 200),
    body: composeReplyBody(input.message, quote),
    content_type: "text/html",
    attachments,
  };

  let payload: Record<string, unknown>;
  if (!agentMode) {
    payload = { ...common, type: "web", sender: "Customer", internal: false };
  } else if (internal) {
    payload = { ...common, type: "note", sender: "Agent", internal: true };
  } else {
    // Resposta do agente ao solicitante = e-mail (é o que notifica a pessoa, como no Zammad).
    const customer = await getPerson(ticket.customer_id);
    if (!customer?.email) return finish(failure("customer_without_email", "O solicitante não tem e-mail cadastrado no Zammad."));
    payload = { ...common, type: "email", sender: "Agent", internal: false, to: customer.email };
  }

  const created = await zammadRequest<{ id: number }>("ticket_articles", {
    method: "POST",
    onBehalfOf: requester.email,
    timeoutMs: 45000,
    body: payload,
  });
  if (!created.success) return finish(created);

  // Resposta do SOLICITANTE em chamado encerrado = quer reabrir. O Zammad só deixa cliente usar o estado
  // "new"; se falhar, a mensagem já foi enviada (a equipe é avisada do mesmo jeito) — não é erro.
  let reopened = false;
  if (!agentMode && describeState(ticket.state ?? "").closed) {
    const stateId = await resolveStateId("new");
    if (stateId.success) {
      const updated = await zammadRequest(`tickets/${ticket.id}`, {
        method: "PUT",
        onBehalfOf: requester.email,
        body: { state_id: stateId.data },
      });
      reopened = updated.success;
    }
  }
  return finish({ success: true, data: { reopened } });
}
