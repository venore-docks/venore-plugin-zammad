import type { OperationResult } from "@venore/plugin-sdk";

// Mudanças num chamado, em um único PUT. Cada campo é opcional.
//   ownerId     = ALOCAR: id do agente que passa a atender; null devolve à fila (sem responsável).
//                 Só gestor/admin; o destino precisa atender o setor do chamado.
//   stateId / pendingTime / priorityId = quem atende o chamado ou o supervisiona.
//   pendingTime = "YYYY-MM-DDTHH:mm" (datetime-local), obrigatório nos estados "pending …".
//   reason      = no fluxo da FEM, texto PÚBLICO que acompanha a mudança de estado (obrigatório em
//                 "Não autorizado"; opcional em "Concluído"). Vira nota pública no mesmo envio.
//   pauseReason = motivo da pausa (chave de `motivo_pausa`), obrigatório ao ir para Em pausa.
//   estimate / deadline = tempo previsto e prazo de entrega: só o administrador do setor. Ao atribuir ou iniciar
//                 sem eles, o plugin preenche 1 dia útil (o Zammad os exige nessa mudança).
export type AgentUpdateInput = {
  ticketId: number;
  stateId?: number;
  pendingTime?: string | null;
  reason?: string | null;
  pauseReason?: string | null;
  // Tempo previsto (chave de uma opção do campo `tempo_previsto`); "" ou null limpa. Só gestor/admin do setor.
  estimate?: string | null;
  // Prazo de entrega, "YYYY-MM-DDTHH:mm" em UTC-3; "" ou null limpa. Só gestor/admin do setor.
  deadline?: string | null;
  priorityId?: number;
  ownerId?: number | null;
};

export type AgentUpdateOutcome = {
  changed: string[];
  // Outros chamados Em andamento do mesmo responsável, pausados por urgência (um Em andamento por agente).
  paused: { id: number; number: string }[];
  // Campos preenchidos com o padrão porque a mudança os exigia: "estimate" (1 dia) e/ou "deadline" (1 dia útil).
  defaults: ("estimate" | "deadline")[];
};
export type AgentUpdateResult = OperationResult<AgentUpdateOutcome>;
