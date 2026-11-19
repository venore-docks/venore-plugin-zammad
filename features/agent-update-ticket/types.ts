import type { OperationResult } from "@venore/plugin-sdk";

// Mudanças num chamado, em um único PUT. Cada campo é opcional.
//   ownerId     = ALOCAR: id do agente que passa a atender; null devolve à fila (sem responsável).
//                 Só gestor/admin; o destino precisa atender o setor do chamado.
//   stateId / pendingTime / priorityId = quem atende o chamado ou o supervisiona.
//   pendingTime = "YYYY-MM-DDTHH:mm" (datetime-local), obrigatório nos estados "pending …".
//   reason      = no fluxo da FEM, texto PÚBLICO que acompanha a mudança de estado (obrigatório em
//                 "Não autorizado"; opcional em "Concluído"). Vira nota pública no mesmo envio.
export type AgentUpdateInput = {
  ticketId: number;
  stateId?: number;
  pendingTime?: string | null;
  reason?: string | null;
  // Tempo previsto (chave de uma opção do campo `tempo_previsto`); "" ou null limpa. Só gestor/admin do setor.
  estimate?: string | null;
  priorityId?: number;
  ownerId?: number | null;
};
export type AgentUpdateResult = OperationResult<{ changed: string[] }>;
