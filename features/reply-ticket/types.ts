import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketAttachment } from "../create-ticket/types";

// quoteArticleId: mensagem que está sendo respondida ("Responder"); o servidor lê o texto dela, o
// navegador nunca envia o trecho citado.
// asAgent / internal: só o app do agente. `internal` = nota interna (a pessoa que abriu nunca a vê).
export type ReplyTicketInput = {
  ticketId: number;
  message: string;
  attachments: TicketAttachment[];
  quoteArticleId?: number | null;
  asAgent?: boolean;
  internal?: boolean;
};
export type ReplyTicketResult = OperationResult<{ reopened: boolean }>;
