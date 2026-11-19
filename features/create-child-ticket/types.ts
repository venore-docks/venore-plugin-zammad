import type { OperationResult } from "@venore/plugin-sdk";
import type { ChildMode } from "../../shared/children";

// Chamado filho a partir de um chamado que a pessoa atende ou supervisiona.
//   subtask  mesmo setor do pai; `ownerId` = agente escolhido pelo gestor (o agente cria para si e ignora o campo)
//   sector   `groupId` = setor que vai receber (entra em Novo, na fila do gestor de lá)
export type CreateChildTicketInput = {
  parentId: number;
  mode: ChildMode;
  groupId?: number | null;
  ownerId?: number | null;
  title: string;
  description: string;
};
export type CreateChildTicketResult = OperationResult<{ id: number; number: string }>;
