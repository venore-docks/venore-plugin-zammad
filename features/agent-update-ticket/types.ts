import type { OperationResult } from "@venore/plugin-sdk";

// Mudanças num chamado, em um único PUT. Cada campo é opcional.
//   ownerId     = ALOCAR: id do agente que passa a atender; null devolve à fila (sem responsável).
//                 Só gestor/admin; o destino precisa atender o setor do chamado.
//   stateId / pendingTime / priorityId = quem atende o chamado ou o supervisiona.
//   pendingTime = "YYYY-MM-DDTHH:mm" (datetime-local), obrigatório nos estados "pending …".
export type AgentUpdateInput = {
  ticketId: number;
  stateId?: number;
  pendingTime?: string | null;
  priorityId?: number;
  ownerId?: number | null;
};
export type AgentUpdateResult = OperationResult<{ changed: string[] }>;
