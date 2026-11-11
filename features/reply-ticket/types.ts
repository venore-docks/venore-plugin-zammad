import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketAttachment } from "../create-ticket/types";

export type ReplyTicketInput = { ticketId: number; message: string; attachments: TicketAttachment[] };
export type ReplyTicketResult = OperationResult<{ reopened: boolean }>;
