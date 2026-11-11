import type { OperationResult } from "@venore/plugin-sdk";

export type TeamMember = {
  id: number;
  name: string;
  // Chamados abertos atribuídos a ele (nos grupos que o gestor enxerga) e quantos esperam resposta dele.
  open: number;
  waiting: number;
};

export type TeamOverview = {
  members: TeamMember[];
  // Chamados sem responsável (a fila) que o gestor pode alocar.
  queue: number;
  groupCount: number;
};

export type GetTeamOverviewResult = OperationResult<TeamOverview>;
