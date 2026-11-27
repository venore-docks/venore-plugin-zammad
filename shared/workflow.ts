import type { ZammadAttribute, ZammadCondition, ZammadWorkflow } from "../contracts/zammad";

// Avaliador local dos Core Workflows do Zammad.
//
// Por que local: o endpoint do próprio Zammad (`POST /core_workflows/perform`) só aceita sessão de
// navegador — com token ele responde "Token authorization failed" (testado no 7.2.2). Então o plugin
// lê as regras (`GET /core_workflows`) e aplica aqui, na mesma ordem do Zammad: estado base vindo
// de `screens` do atributo, depois cada workflow ativo por prioridade crescente (o último que mexe
// num campo vence). Condição ou ação que não sabemos avaliar entra em `unsupported` — a tela de admin
// mostra, para ninguém confiar num formulário que diverge do Zammad sem saber.
//
// Condições sobre VALORES de campos (ex.: "sistema_afetado é portal → mostra ferramenta_portal") só casam se as
// respostas já dadas entram em `ticket`. Quem monta o formulário reavalia a cada resposta (`resolveForm` em
// form.ts); avaliar uma vez só com o grupo deixa esses campos sempre ocultos (bug da v1.10.1).
// Puro e sem dependência de servidor: o wizard (navegador) usa o mesmo código.

export type FieldState = {
  visible: boolean;
  mandatory: boolean;
  readonly: boolean;
  // null = todas as opções do atributo; lista = só estas (set_fixed_to / remove_option / add_option).
  allowed: string[] | null;
  fill: unknown;
};

export type EvaluationContext = {
  screen: string;
  // Valores escolhidos no formulário (condition_selected): `group_id` e as respostas já dadas.
  ticket: Record<string, unknown>;
  // Valores do ticket já salvo (condition_saved). Na criação não há ticket salvo: vazio.
  saved?: Record<string, unknown>;
  // userId: quem age, para condições com `pre_condition: "current_user.id"` (ex.: "cliente não é quem está editando").
  session: { roleIds: number[]; userId?: number };
  // Que coluna de `screens` vale: cliente ou agente (quem abre pelo portal é tratado como cliente).
  role: "ticket.customer" | "ticket.agent";
  // Só para listar os campos que PODEM aparecer (visão do admin): condição sobre o valor de um campo do ticket
  // (fora grupo e estado) conta como verdadeira.
  assumeFieldConditions?: boolean;
};

export type EvaluationResult = { fields: Record<string, FieldState>; unsupported: string[] };

// Atributos que o wizard pode perguntar: os customizados (editable) e ativos. Os do sistema (título,
// cliente, grupo, estado, prioridade do agente…) são tratados à parte ou ficam com o padrão do Zammad.
export function isWizardAttribute(attribute: ZammadAttribute): boolean {
  return attribute.object === "Ticket" && attribute.active && attribute.editable;
}

// Campos do ticket cujas condições dependem do contexto e não da resposta da pessoa.
const CONTEXT_FIELDS = new Set(["group_id", "state_id", "owner_id", "customer_id", "organization_id", "priority_id"]);

export function applicableWorkflows(workflows: readonly ZammadWorkflow[], screen: string): ZammadWorkflow[] {
  return workflows
    .filter((workflow) => workflow.active && workflow.object === "Ticket" && appliesToScreen(workflow, screen))
    .sort((a, b) => a.priority - b.priority || a.id - b.id);
}

export function evaluateWorkflows(
  attributes: readonly ZammadAttribute[],
  workflows: readonly ZammadWorkflow[],
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

  for (const workflow of applicableWorkflows(workflows, context.screen)) {
    const label = `workflow #${workflow.id} "${workflow.name}"`;
    const matched =
      matchesConditions(workflow.condition_selected, context, context.ticket, label, unsupported) &&
      matchesConditions(workflow.condition_saved, context, context.saved ?? {}, label, unsupported);
    if (!matched) continue;

    for (const [key, action] of Object.entries(workflow.perform ?? {})) {
      if (!key.startsWith("ticket.")) continue;
      const name = key.slice("ticket.".length);
      const state = fields[name];
      const attribute = byName.get(name);
      if (!state || !attribute) continue;
      for (const operator of operatorsOf(action)) {
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

// De que campos (respostas) depende cada campo: o alvo de uma ação ← os campos do ticket citados nas condições da
// mesma regra (fora os de contexto, como grupo e estado). O wizard usa isto para mostrar o campo dependente na
// mesma etapa do campo que o libera.
export function fieldDependencies(workflows: readonly ZammadWorkflow[], screen: string): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();
  for (const workflow of applicableWorkflows(workflows, screen)) {
    const sources = new Set<string>();
    collectConditionFields(workflow.condition_selected, sources);
    collectConditionFields(workflow.condition_saved, sources);
    if (sources.size === 0) continue;
    for (const key of Object.keys(workflow.perform ?? {})) {
      if (!key.startsWith("ticket.")) continue;
      const target = key.slice("ticket.".length);
      const set = dependencies.get(target) ?? new Set<string>();
      sources.forEach((source) => source !== target && set.add(source));
      if (set.size > 0) dependencies.set(target, set);
    }
  }
  return dependencies;
}

// A regra casa neste contexto? (as mesmas condições do `evaluateWorkflows`, sem aplicar ações)
export function workflowMatches(workflow: ZammadWorkflow, context: EvaluationContext): boolean {
  const ignored = new Set<string>();
  const label = `workflow #${workflow.id}`;
  return (
    matchesConditions(workflow.condition_selected, context, context.ticket, label, ignored) &&
    matchesConditions(workflow.condition_saved, context, context.saved ?? {}, label, ignored)
  );
}

export function hasFieldConditions(workflow: ZammadWorkflow): boolean {
  const sources = new Set<string>();
  collectConditionFields(workflow.condition_selected, sources);
  collectConditionFields(workflow.condition_saved, sources);
  return sources.size > 0;
}

function collectConditionFields(conditions: Record<string, unknown> | null | undefined, out: Set<string>): void {
  if (!conditions) return;
  const visit = (name: string | undefined) => {
    if (!name?.startsWith("ticket.")) return;
    const field = name.slice("ticket.".length);
    if (!CONTEXT_FIELDS.has(field)) out.add(field);
  };
  const walk = (node: ZammadCondition) => {
    if (Array.isArray(node.conditions)) node.conditions.forEach(walk);
    else visit(node.name);
  };
  if (typeof conditions.operator === "string" && Array.isArray(conditions.conditions)) {
    walk(conditions as unknown as ZammadCondition);
    return;
  }
  Object.keys(conditions).forEach(visit);
}

function operatorsOf(action: { operator: string | string[] }): string[] {
  return Array.isArray(action.operator) ? action.operator : [action.operator];
}

function baseState(attribute: ZammadAttribute, context: EvaluationContext): FieldState {
  const screen = attribute.screens?.[context.screen] ?? {};
  const config = screen[context.role] ?? screen["-all-"];
  if (!config) return { visible: false, mandatory: false, readonly: false, allowed: null, fill: null };
  const visible = config.shown ?? true;
  const mandatory = config.required ?? config.null === false;
  return { visible, mandatory, readonly: false, allowed: null, fill: null };
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

// "is_not", "Is Not" e "is not" são o mesmo operador.
export function normalizeOperator(operator: string): string {
  return operator.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();
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
    const field = name.slice("ticket.".length);
    if (context.assumeFieldConditions && !CONTEXT_FIELDS.has(field)) return true;
    actual = ticket[field];
  } else if (name === "session.role_ids") {
    actual = context.session.roleIds;
  } else {
    unsupported.add(`${label}: condição em "${name}" não é avaliada (a regra é ignorada)`);
    return false;
  }

  // `pre_condition` (campos de usuário/organização): "current_user.id" compara com quem age; "not_set" com vazio;
  // "specific" (ou ausente) com `value`.
  let expectedValue: unknown = condition.value;
  if (condition.pre_condition === "current_user.id") {
    if (context.session.userId === undefined) {
      unsupported.add(`${label}: condição "${name}" com o usuário atual, sem usuário no contexto (a regra é ignorada)`);
      return false;
    }
    expectedValue = [context.session.userId];
  } else if (condition.pre_condition === "not_set") {
    expectedValue = [];
  }

  const result = compare(normalizeOperator(condition.operator ?? ""), toStringList(actual), toStringList(expectedValue));
  if (result === null) {
    unsupported.add(`${label}: operador "${condition.operator}" em "${name}" não é avaliado (a regra é ignorada)`);
    return false;
  }
  return result;
}

// Operadores de condição do Zammad que dependem só do valor. null = operador não avaliado (ex.: "has changed",
// datas relativas): a regra não casa e vai para `unsupported`.
function compare(operator: string, actual: string[], expected: string[]): boolean | null {
  const lower = (list: string[]) => list.map((value) => value.toLowerCase());
  const any = (predicate: (value: string) => boolean) => actual.some(predicate);
  switch (operator) {
    case "is":
    case "is any of":
      return any((value) => expected.includes(value));
    case "is not":
    case "is none of":
      return !any((value) => expected.includes(value));
    case "is set":
      return actual.length > 0;
    case "not set":
    case "is not set":
      return actual.length === 0;
    case "contains": {
      const needles = lower(expected);
      return lower(actual).some((value) => needles.some((needle) => value.includes(needle)));
    }
    case "contains not": {
      const needles = lower(expected);
      return !lower(actual).some((value) => needles.some((needle) => value.includes(needle)));
    }
    case "contains all":
      return expected.every((value) => actual.includes(value));
    case "contains one":
      return expected.some((value) => actual.includes(value));
    case "contains all not":
      return !expected.every((value) => actual.includes(value));
    case "contains one not":
      return !expected.some((value) => actual.includes(value));
    case "starts with":
    case "starts with one of": {
      const prefixes = lower(expected);
      return lower(actual).some((value) => prefixes.some((prefix) => value.startsWith(prefix)));
    }
    case "ends with":
    case "ends with one of": {
      const suffixes = lower(expected);
      return lower(actual).some((value) => suffixes.some((suffix) => value.endsWith(suffix)));
    }
    case "regex match":
    case "regex mismatch": {
      const matched = expected.some((pattern) => {
        try {
          const regex = new RegExp(pattern, "i");
          return actual.some((value) => regex.test(value));
        } catch {
          return false;
        }
      });
      return operator === "regex match" ? matched : !matched;
    }
    default:
      return null;
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
    case "set_readonly":
      state.readonly = true;
      return;
    case "unset_readonly":
      state.readonly = false;
      return;
    case "set_fixed_to":
      state.allowed = toStringList(value);
      return;
    case "add_option":
      // Sem restrição anterior, todas as opções já valem.
      if (state.allowed) {
        const add = toStringList(value).filter((option) => optionValues(attribute).includes(option));
        state.allowed = [...new Set([...state.allowed, ...add])];
      }
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
    default:
      unsupported.add(`${label}: ação "${operator}" em "${attribute.name}" não é aplicada`);
  }
}

// Grupos que a máscara de criação do Zammad deixa escolher, pelos Core Workflows que mexem em
// `ticket.group_id` (no Zammad da FEM: 520 "Grupos ocultos para clientes" remove todos, 521–524 devolvem o
// grupo do setor a quem tem a função "<Setor> - Cliente"). Mesma ordem e mesmas condições do resto.
//   null  = nenhum workflow restringe (todos os grupos).
//   lista = só estes ids (string), já com add/remove aplicados.
// `allGroupIds` é a base para "remover opção" quando nada fixou a lista antes.
export function allowedGroupIds(
  workflows: readonly ZammadWorkflow[],
  context: Omit<EvaluationContext, "ticket">,
  allGroupIds: readonly string[],
): { allowed: string[] | null; unsupported: string[] } {
  const unsupported = new Set<string>();
  let allowed: string[] | null = null;

  for (const workflow of applicableWorkflows(workflows, context.screen)) {
    const label = `workflow #${workflow.id} "${workflow.name}"`;
    const action = workflow.perform?.["ticket.group_id"];
    const fullContext = { ...context, ticket: {} };
    const matched =
      matchesConditions(workflow.condition_selected, fullContext, {}, label, unsupported) &&
      matchesConditions(workflow.condition_saved, fullContext, {}, label, unsupported);
    if (!matched) continue;
    if (action) {
      for (const operator of operatorsOf(action)) {
        const value = toStringList(action[operator]);
        if (operator === "set_fixed_to") allowed = value;
        else if (operator === "remove_option") allowed = (allowed ?? [...allGroupIds]).filter((id) => !value.includes(id));
        else if (operator === "add_option") allowed = allowed === null ? null : [...new Set([...allowed, ...value])];
        else if (operator !== "set_readonly" && operator !== "unset_readonly" && operator !== "show" && operator !== "set_mandatory") {
          unsupported.add(`${label}: ação "${operator}" em "group_id" não é aplicada`);
        }
      }
    }
    if (workflow.stop_after_match) break;
  }
  return { allowed, unsupported: [...unsupported] };
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
