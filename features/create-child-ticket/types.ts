import type { OperationResult } from "@venore/plugin-sdk";
import type { AnswerValue } from "../../contracts/types";
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
  // Respostas dos campos do setor de destino (get-child-form). O servidor remonta o formulário e revalida.
  answers?: Record<string, AnswerValue | null>;
};
export type CreateChildTicketResult = OperationResult<{ id: number; number: string }>;
