import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketDetail } from "../../contracts/types";

// asAgent: o app pede a visão de agente (atribuídos a ele e fila). O portal comum nunca pede.
export type GetTicketInput = { ticketId: number; asAgent?: boolean };
export type GetTicketResult = OperationResult<TicketDetail>;
