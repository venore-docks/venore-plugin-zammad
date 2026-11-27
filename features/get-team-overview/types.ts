import type { OperationResult } from "@venore/plugin-sdk";

export type TeamMember = {
  id: number;
  name: string;
  // Chamados abertos atribuídos a ele (nos grupos que o gestor enxerga); quantos têm resposta nova do solicitante (a
  // vez é dele); e quantos esperam a resposta do solicitante (Aguardando solicitante: a vez é do solicitante).
  open: number;
  waiting: number;
  awaitingRequester: number;
  // Setores (grupos do Zammad) que ele atende, dentre os que o gestor gerencia.
  groupIds: number[];
};

export type TeamGroup = { id: number; name: string };

export type TeamOverview = {
  members: TeamMember[];
  // Chamados sem responsável que esperam a decisão do gestor (os mesmos do grupo "Decisão do gestor" da Fila).
  queue: number;
  groupCount: number;
  // Os setores que o gestor gerencia (com nome), para filtrar a equipe por setor.
  groups: TeamGroup[];
};

export type GetTeamOverviewResult = OperationResult<TeamOverview>;
