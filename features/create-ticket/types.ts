import type { OperationResult } from "@venore/plugin-sdk";
import type { AnswerValue, CreatedTicket } from "../../contracts/types";

export type TicketAttachment = { filename: string; mimeType: string; size: number; base64: string };

export type CreateTicketInput = {
  groupId: number;
  title: string;
  description: string;
  answers: Record<string, AnswerValue | null>;
  attachments: TicketAttachment[];
};

export type CreateTicketResult = OperationResult<CreatedTicket>;
