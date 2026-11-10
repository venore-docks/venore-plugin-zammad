import type { ZammadAttribute, ZammadCondition, ZammadWorkflow } from "../contracts/zammad";

// Avaliador local dos Core Workflows do Zammad para a tela de criação de ticket.
//
// Por que local: o endpoint do próprio Zammad (`POST /core_workflows/perform`) só aceita sessão de
// navegador — com token ele responde "Token authorization failed" (testado no 7.2.2). Então o plugin
// lê as regras (`GET /core_workflows`) e aplica aqui, na mesma ordem do Zammad: estado base vindo
// de `screens` do atributo, depois cada workflow ativo por prioridade crescente (o último que mexe
// num campo vence). Condição ou ação que não sabemos avaliar entra em `unsupported` — a tela de admin
// mostra, para ninguém confiar num formulário que diverge do Zammad sem saber.

export type FieldState = {
  visible: boolean;
  mandatory: boolean;
  // null = todas as opções do atributo; lista = só estas (set_fixed_to / remove_option / add_option).
  allowed: string[] | null;
  fill: unknown;
};

export type EvaluationContext = {
  screen: string;
  // Valores já escolhidos no formulário (`group_id` é o que importa na criação).
  ticket: Record<string, unknown>;
  session: { roleIds: number[] };
  // Que coluna de `screens` vale: cliente ou agente (quem abre pelo portal é tratado como cliente).
  role: "ticket.customer" | "ticket.agent";
};

export type EvaluationResult = { fields: Record<string, FieldState>; unsupported: string[] };

// Atributos que o wizard pode perguntar: os customizados (editable) e ativos. Os do sistema (título,
// cliente, grupo, estado, prioridade do agente…) são tratados à parte ou ficam com o padrão do Zammad.
export function isWizardAttribute(attribute: ZammadAttribute): boolean {
  return attribute.object === "Ticket" && attribute.active && attribute.editable;
}

export function evaluateWorkflows(
  attributes: ZammadAttribute[],
  workflows: ZammadWorkflow[],
  context: EvaluationContext,
): EvaluationResult {
  const unsupported = new Set<string>();
  const fields: Record<string, FieldState> = {};
  const byName = new Map<string, ZammadAttribute>();

  for (const attribute of attributes) {
    if (!isWizardAttribute(attribute)) continue;
    byName.set(attribute.name, attribute);
    fields[attribute.name] = baseState(attribute, context);
  }

  const applicable = workflows
    .filter((workflow) => workflow.active && workflow.object === "Ticket" && appliesToScreen(workflow, context.screen))
    .sort((a, b) => a.priority - b.priority || a.id - b.id);

  for (const workflow of applicable) {
    const label = `workflow #${workflow.id} "${workflow.name}"`;
    const matched =
      matchesConditions(workflow.condition_selected, context, context.ticket, label, unsupported) &&
      // Na criação ainda não há ticket salvo: condição "salva" só casa se não exigir valor.
      matchesConditions(workflow.condition_saved, context, {}, label, unsupported);
    if (!matched) continue;

    for (const [key, action] of Object.entries(workflow.perform ?? {})) {
      if (!key.startsWith("ticket.")) continue;
      const name = key.slice("ticket.".length);
      const state = fields[name];
      const attribute = byName.get(name);
      if (!state || !attribute) continue;
      const operators = Array.isArray(action.operator) ? action.operator : [action.operator];
      for (const operator of operators) {
        applyOperator(state, attribute, operator, action[operator], label, unsupported);
      }
    }
    if (workflow.stop_after_match) break;
  }

  for (const state of Object.values(fields)) {
    if (!state.visible) state.mandatory = false;
  }
  return { fields, unsupported: [...unsupported] };
}

function baseState(attribute: ZammadAttribute, context: EvaluationContext): FieldState {
  const screen = attribute.screens?.[context.screen] ?? {};
  const config = screen[context.role] ?? screen["-all-"];
  if (!config) return { visible: false, mandatory: false, allowed: null, fill: null };
  const visible = config.shown ?? true;
  const mandatory = config.required ?? config.null === false;
  return { visible, mandatory, allowed: null, fill: null };
}

function appliesToScreen(workflow: ZammadWorkflow, screen: string): boolean {
  const screens = workflow.preferences?.screen;
  if (screens === undefined || screens === null) return true;
  const list = Array.isArray(screens) ? screens : [screens];
  // Lista vazia no Zammad = "qualquer tela".
  return list.length === 0 || list.includes(screen);
}

function matchesConditions(
  conditions: Record<string, unknown> | null | undefined,
  context: EvaluationContext,
  ticket: Record<string, unknown>,
  label: string,
  unsupported: Set<string>,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  // Modo "expert": { operator: "AND" | "OR" | "NOT", conditions: [{ name, operator, value }] }
  if (typeof conditions.operator === "string" && Array.isArray(conditions.conditions)) {
    return matchesExpert(conditions as unknown as ZammadCondition, context, ticket, label, unsupported);
  }
  return Object.entries(conditions).every(([name, condition]) =>
    matchesOne(name, condition as ZammadCondition, context, ticket, label, unsupported),
  );
}

function matchesExpert(
  node: ZammadCondition,
  context: EvaluationContext,
  ticket: Record<string, unknown>,
  label: string,
  unsupported: Set<string>,
): boolean {
  if (Array.isArray(node.conditions)) {
    const results = node.conditions.map((child) => matchesExpert(child, context, ticket, label, unsupported));
    const op = node.operator.toUpperCase();
    if (op === "OR") return results.some(Boolean);
    if (op === "NOT") return !results.some(Boolean);
    return results.every(Boolean);
  }
  return matchesOne(node.name ?? "", node, context, ticket, label, unsupported);
}

function matchesOne(
  name: string,
  condition: ZammadCondition,
  context: EvaluationContext,
  ticket: Record<string, unknown>,
  label: string,
  unsupported: Set<string>,
): boolean {
  let actual: unknown;
  if (name.startsWith("ticket.")) {
    actual = ticket[name.slice("ticket.".length)];
  } else if (name === "session.role_ids") {
    actual = context.session.roleIds;
  } else {
    unsupported.add(`${label}: condição em "${name}" não é avaliada (a regra é ignorada)`);
    return false;
  }

  const actualValues = toStringList(actual);
  const expected = toStringList(condition.value);
  switch (condition.operator) {
    case "is":
      return actualValues.some((value) => expected.includes(value));
    case "is not":
      return !actualValues.some((value) => expected.includes(value));
    case "is set":
      return actualValues.length > 0;
    case "not set":
      return actualValues.length === 0;
    default:
      unsupported.add(`${label}: operador "${condition.operator}" em "${name}" não é avaliado (a regra é ignorada)`);
      return false;
  }
}

function applyOperator(
  state: FieldState,
  attribute: ZammadAttribute,
  operator: string,
  value: unknown,
  label: string,
  unsupported: Set<string>,
): void {
  switch (operator) {
    case "show":
      state.visible = true;
      return;
    case "hide":
    case "remove":
      state.visible = false;
      return;
    case "set_mandatory":
      state.mandatory = true;
      return;
    case "set_optional":
      state.mandatory = false;
      return;
    case "set_fixed_to":
      state.allowed = toStringList(value);
      return;
    case "add_option":
      if (state.allowed) state.allowed = [...new Set([...state.allowed, ...toStringList(value)])];
      return;
    case "remove_option": {
      const remove = toStringList(value);
      const current = state.allowed ?? optionValues(attribute);
      state.allowed = current.filter((option) => !remove.includes(option));
      return;
    }
    case "fill_in":
    case "fill_in_empty":
    case "select":
    case "auto_select":
      state.fill = value;
      return;
    case "set_readonly":
    case "unset_readonly":
      return;
    default:
      unsupported.add(`${label}: ação "${operator}" em "${attribute.name}" não é aplicada`);
  }
}

export function toStringList(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== "").map(String);
  return [String(value)];
}

// Chaves das opções de select/multiselect/tree_select, no formato que o Zammad grava no ticket.
export function optionValues(attribute: ZammadAttribute): string[] {
  return flattenOptions(attribute.data_option.options).map((option) => option.value);
}

export function flattenOptions(raw: unknown, prefix = ""): { value: string; label: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    // [{ name, value, children? }] — tree_select e selects com ordem customizada.
    return raw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as { name?: unknown; value?: unknown; children?: unknown };
      const value = String(entry.value ?? entry.name ?? "");
      const label = `${prefix}${String(entry.name ?? entry.value ?? "")}`;
      const children = Array.isArray(entry.children) ? flattenOptions(entry.children, `${label} › `) : [];
      return [{ value, label }, ...children];
    });
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([value, label]) => ({ value, label: `${prefix}${String(label)}` }));
  }
  return [];
}
