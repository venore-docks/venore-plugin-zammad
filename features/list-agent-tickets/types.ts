import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketSummary } from "../../contracts/types";

// assigned  = os atribuídos à própria pessoa (agente, gestor, admin)
// queue     = sem responsável, nos grupos dela — SÓ gestor/admin (o agente comum não vê a fila)
// of-agent  = os atribuídos a um agente da equipe — SÓ gestor/admin
export type ListAgentTicketsInput = { kind: "assigned" } | { kind: "queue" } | { kind: "of-agent"; agentId: number };
export type ListAgentTicketsResult = OperationResult<{ tickets: TicketSummary[] }>;
