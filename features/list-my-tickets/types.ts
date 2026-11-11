import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketSummary } from "../../contracts/types";

export type ListMyTicketsResult = OperationResult<{ tickets: TicketSummary[] }>;
