import type { OperationResult } from "@venore/plugin-sdk";

export type ChangeTicketStateInput = { ticketId: number; action: "close" | "reopen" };
export type ChangeTicketStateResult = OperationResult<{ closed: boolean }>;
