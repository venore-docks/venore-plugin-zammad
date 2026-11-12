import type { OperationResult } from "@venore/plugin-sdk";
import type { TicketSummary } from "../../contracts/types";
import type { AgentStats } from "../../shared/agent-stats";

// Dados do dashboard "Meu atendimento": só o que está atribuído ao próprio agente.
export type AgentDashboardData = {
  stats: AgentStats;
  /** O solicitante falou por último: mais urgentes e mais antigos primeiro (até 5). */
  needsReply: TicketSummary[];
  /** O resto dos atribuídos (até 5). */
  inProgress: TicketSummary[];
};
export type GetAgentDashboardResult = OperationResult<AgentDashboardData>;
