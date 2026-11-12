import type { OperationResult } from "@venore/plugin-sdk";
import type { AgentLoadRow, ManagerKpis, SectorChip } from "../../shared/manager-stats";

// Quem pode receber um chamado e quanto já tem (null = carga desconhecida: fora da equipe lida).
export type AssigneeOption = { id: number; name: string; open: number | null; waiting: number | null };

// Um chamado da fila (sem responsável), pronto para a lista com alocação rápida.
export type QueueRow = {
  id: number;
  number: string;
  title: string;
  group: string;
  groupId: number;
  priorityId: number;
  priorityLabel: string;
  urgent: boolean;
  requesterName: string | null;
  // Há quanto tempo o chamado foi aberto (ms), calculado no servidor.
  ageMs: number;
};

// Opções de alocação por setor (grupo do Zammad), sem repetir por chamado.
export type AllocationOptions = {
  byGroup: Record<number, AssigneeOption[]>;
  // O agente menos carregado de cada setor (só quando há carga conhecida).
  suggestedByGroup: Record<number, number | null>;
};

export type ManagerDashboardData = {
  kpis: ManagerKpis;
  agents: AgentLoadRow[];
  // Os mais antigos da fila (até 5).
  queueTop: QueueRow[];
  allocation: AllocationOptions;
};

export type QueueBoardData = {
  items: QueueRow[];
  sectors: SectorChip[];
  allocation: AllocationOptions;
};

// Carga por agente (para a sugestão no detalhe do chamado).
export type TeamLoads = Record<number, { open: number; waiting: number }>;

export type GetManagerDashboardResult = OperationResult<ManagerDashboardData>;
export type GetQueueBoardResult = OperationResult<QueueBoardData>;
export type GetTeamLoadsResult = OperationResult<TeamLoads>;
