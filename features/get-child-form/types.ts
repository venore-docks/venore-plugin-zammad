import type { OperationResult } from "@venore/plugin-sdk";
import type { AnswerValue, FieldPresentation, FormRules, WizardField } from "../../contracts/types";
import type { ChildMode } from "../../shared/children";

// Campos do setor que vai receber o chamado filho (lidos do Zammad) e as respostas iniciais herdadas do pai.
//   subtask  setor = o do pai (groupId ignorado)
//   sector   groupId = setor escolhido (folha)
export type GetChildFormInput = {
  parentId: number;
  mode: ChildMode;
  groupId?: number | null;
};

export type ChildFormData = {
  groupId: number;
  fields: WizardField[];
  defaults: Record<string, AnswerValue | null>;
  rules: FormRules;
  presentation: FieldPresentation;
};

export type GetChildFormResult = OperationResult<ChildFormData>;
