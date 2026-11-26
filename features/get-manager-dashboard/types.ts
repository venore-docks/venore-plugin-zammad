import type { OperationResult } from "@venore/plugin-sdk";
import type { FlowStepKey, TicketStateColor } from "../../contracts/types";
import type { AgentLoadRow, ManagerKpis, QueueSort, SectorChip } from "../../shared/manager-stats";
import type { QueueBucket, StageBucket } from "../../shared/queue-buckets";

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
  // Etapa do fluxo da FEM (null fora do fluxo), o estado para exibir e a aba da fila do gestor.
  step: FlowStepKey | null;
  stateLabel: string;
  stateColor: TicketStateColor;
  bucket: StageBucket;
  // Responsável (null = sem responsável).
  ownerId: number | null;
  ownerName: string | null;
  // Tags do chamado no Zammad (ex.: ajustes, rejeitado, nao-autorizado, reenviado).
  tags: string[];
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
  flowStateIds: Partial<Record<FlowStepKey, number>>;
};

// `bucket`: a aba pedida (ausente = "abertos", todos os chamados abertos por etapa). `groupId` e `sort` valem em
// "abertos": o filtro de setor e a ordem das linhas dentro de cada etapa.
export type GetQueueBoardInput = { bucket?: QueueBucket; groupId?: number; sort?: QueueSort };

export type QueueBoardData = {
  // A aba mostrada e as linhas DELA (só essas vêm com solicitante e tags).
  bucket: QueueBucket;
  items: QueueRow[];
  sectors: SectorChip[];
  allocation: AllocationOptions;
  counts: Record<QueueBucket, number>;
  // Contagem por etapa depois do filtro de setor (igual a `counts` sem filtro): os totais dos subtítulos de "Em aberto".
  filteredCounts: Record<QueueBucket, number>;
  // Abas cuja contagem não foi calculada (Finalizado, fora da própria aba): a tela não mostra número.
  uncounted: QueueBucket[];
  // Id de cada estado do fluxo no Zammad (para os botões Autorizar, Não autorizar, Em análise).
  flowStateIds: Partial<Record<FlowStepKey, number>>;
};

// Carga por agente (para a sugestão no detalhe do chamado).
export type TeamLoads = Record<number, { open: number; waiting: number }>;

export type GetManagerDashboardResult = OperationResult<ManagerDashboardData>;
export type GetQueueBoardResult = OperationResult<QueueBoardData>;
export type GetTeamLoadsResult = OperationResult<TeamLoads>;
