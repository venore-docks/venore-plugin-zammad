import type { OperationResult } from "@venore/plugin-sdk";

// Mudanças do agente num chamado. Cada campo é opcional; vão juntos num único PUT.
//   owner "me"      = assumir (chamado na fila, ou já dele)
//   owner "release" = devolver à fila (deixa sem responsável)
//   pendingTime     = "YYYY-MM-DDTHH:mm" (datetime-local), obrigatório nos estados "pending …"
export type AgentUpdateInput = {
  ticketId: number;
  stateId?: number;
  pendingTime?: string | null;
  priorityId?: number;
  owner?: "me" | "release";
};
export type AgentUpdateResult = OperationResult<{ changed: string[] }>;
