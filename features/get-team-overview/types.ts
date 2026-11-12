import type { OperationResult } from "@venore/plugin-sdk";

export type TeamMember = {
  id: number;
  name: string;
  // Chamados abertos atribuídos a ele (nos grupos que o gestor enxerga) e quantos esperam resposta dele.
  open: number;
  waiting: number;
  // Setores (grupos do Zammad) que ele atende, dentre os que o gestor gerencia.
  groupIds: number[];
};

export type TeamGroup = { id: number; name: string };

export type TeamOverview = {
  members: TeamMember[];
  // Chamados sem responsável (a fila) que o gestor pode alocar.
  queue: number;
  groupCount: number;
  // Os setores que o gestor gerencia (com nome), para filtrar a equipe por setor.
  groups: TeamGroup[];
};

export type GetTeamOverviewResult = OperationResult<TeamOverview>;
