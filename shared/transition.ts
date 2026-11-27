import type { FieldOption } from "../contracts/types";
import type { ZammadAttribute, ZammadWorkflow } from "../contracts/zammad";
import { evaluateWorkflows, flattenOptions } from "./workflow";

// O que uma mudança no chamado (estado, responsável…) EXIGE, pelos Core Workflows da tela de edição do Zammad.
// O Zammad aplica essas obrigatoriedades também na API ("Missing required value for field 'x'", 422): o plugin
// descobre antes e coleta (ou preenche o padrão) no mesmo envio. Na FEM:
//   regra 810  entrar em Atribuído (10) ou Em andamento (8), vindo de outro estado → tempo_previsto e prazo_entrega
//   regra 800  entrar em Em pausa (11) → motivo_pausa
// Puro: testado em transition.test.ts e form-live.test.ts.

export type TransitionContext = { roleIds: number[]; userId: number };
export type RequiredField = { name: string; label: string; options: FieldOption[] };

export function missingForChange(
  rules: { attributes: readonly ZammadAttribute[]; workflows: readonly ZammadWorkflow[] },
  ticket: Record<string, unknown>,
  changes: Record<string, unknown>,
  context: TransitionContext,
): RequiredField[] {
  const selected = { ...ticket, ...changes };
  const evaluation = evaluateWorkflows(rules.attributes, rules.workflows, {
    screen: "edit",
    ticket: selected,
    saved: ticket,
    session: { roleIds: context.roleIds, userId: context.userId },
    role: "ticket.agent",
  });
  const byName = new Map(rules.attributes.map((attribute) => [attribute.name, attribute]));
  return Object.entries(evaluation.fields)
    .filter(([name, state]) => state.visible && state.mandatory && isEmptyValue(selected[name]))
    .map(([name, state]) => {
      const attribute = byName.get(name);
      const options = flattenOptions(attribute?.data_option?.options).filter((option) => option.value !== "" && (!state.allowed || state.allowed.includes(option.value)));
      return { name, label: attribute?.display ?? name, options };
    });
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
