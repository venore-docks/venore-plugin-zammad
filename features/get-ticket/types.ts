import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketDetail } from "../../contracts/types";

export type GetTicketInput = { ticketId: number };
export type GetTicketResult = OperationResult<TicketDetail>;
