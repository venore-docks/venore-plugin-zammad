import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketSummary } from "../../contracts/types";

// assigned = atribuídos ao agente; queue = sem responsável, nos grupos dele (para assumir).
export type AgentListKind = "assigned" | "queue";

export type ListAgentTicketsInput = { kind: AgentListKind };
export type ListAgentTicketsResult = OperationResult<{ tickets: TicketSummary[] }>;
