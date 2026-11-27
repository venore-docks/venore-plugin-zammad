import type {
  AnswerValue,
  FieldPresentation,
  FieldType,
  FormRules,
  GroupWizardConfig,
  SectorForm,
  WizardConfig,
  WizardField,
  WizardStep,
} from "../contracts/types";
import type { ZammadAttribute, ZammadGroup, ZammadSchema, ZammadWorkflow } from "../contracts/zammad";
import type { Answers } from "./answers";
import { stripNumbersFromOptions } from "./format";
import { DEFAULT_AUDIENCE, isSectorVisible, type AudienceViewer } from "./audience";
import {
  allowedGroupIds,
  applicableWorkflows,
  evaluateWorkflows,
  fieldDependencies,
  flattenOptions,
  hasFieldConditions,
  isWizardAttribute,
  workflowMatches,
  type EvaluationContext,
} from "./workflow";

// Monta o formulário em etapas de cada setor (= grupo do Zammad) a partir do schema do Zammad e da
// configuração de apresentação. Puro e sem dependência de servidor: o wizard (navegador) reavalia com
// `resolveForm` a cada resposta e o servidor faz o mesmo com as respostas finais antes de criar o chamado.
// Os testes rodam contra o recorte real em __fixtures__.

export const DEFAULT_GROUP_CONFIG: GroupWizardConfig = {
  enabled: true,
  audience: DEFAULT_AUDIENCE,
  label: null,
  description: null,
  bodyHint: null,
  order: null,
  fieldHelp: {},
  fieldSteps: {},
  stepTitles: {},
};

export function groupConfigFor(config: WizardConfig, groupId: number): GroupWizardConfig {
  return { ...DEFAULT_GROUP_CONFIG, ...(config.groups[String(groupId)] ?? {}) };
}

export type BuildOptions = {
  roleIds?: number[];
  role?: EvaluationContext["role"];
  // Admin vê também os setores ocultos (para poder reativar).
  includeDisabled?: boolean;
  // Quem está pedindo: só os setores da audiência dele entram (admin vê todos). Sem `viewer`, não filtra.
  viewer?: AudienceViewer;
};

// Campos de triagem que o solicitante nunca responde, mesmo que o Zammad os mostre ao cliente: quem define é a
// equipe. A prioridade nativa é do gestor; a SUGESTÃO do solicitante é o campo customizado
// `prioridade_sugerida` (o Zammad não deixa cliente ver a prioridade nativa na criação), que o wizard pergunta
// normalmente e os gatilhos "Sincronizar Prioridade - …" copiam para a nativa na criação.
// `tempo_previsto`, `prazo_entrega` e `motivo_pausa` são do andamento (gestor/agente), nunca da abertura.
export const NEVER_ASKED: ReadonlySet<string> = new Set([
  "priority_id",
  "tempo_previsto",
  "prazo_entrega",
  "motivo_pausa",
  "state_id",
  "owner_id",
  "customer_id",
  "group_id",
  "title",
]);

// `prioridade_cliente` ("Prioridade inicial"/"Prioridade sugerida" no Zammad da FEM) só é perguntada quando o
// Zammad a torna OBRIGATÓRIA para quem abre (atributo ou Core Workflow); opcional, fica de fora, como antes.
export const ASKED_ONLY_IF_REQUIRED: ReadonlySet<string> = new Set(["prioridade_cliente"]);

export const CREATE_SCREEN = "create_middle";

export type BuiltForms = { sectors: SectorForm[]; rules: FormRules; unsupported: string[]; skippedFields: string[] };

// Recorte das regras do Zammad que o formulário de abertura usa (vai ao navegador): só os atributos que o wizard
// pode perguntar, com a configuração da tela, e os Core Workflows ativos da tela que mexem nesses campos.
export function formRules(schema: ZammadSchema, roleIds: number[], role: EvaluationContext["role"], screen: string = CREATE_SCREEN): FormRules {
  const attributes = schema.attributes
    .filter((attribute) => isWizardAttribute(attribute) && !NEVER_ASKED.has(attribute.name))
    .map((attribute): ZammadAttribute => ({
      name: attribute.name,
      object: attribute.object,
      display: attribute.display,
      data_type: attribute.data_type,
      active: attribute.active,
      editable: attribute.editable,
      position: attribute.position,
      data_option: attribute.data_option,
      screens: attribute.screens?.[screen] ? { [screen]: attribute.screens[screen] } : {},
    }));
  const names = new Set(attributes.map((attribute) => `ticket.${attribute.name}`));
  const workflows = applicableWorkflows(schema.workflows, screen)
    .map((workflow): ZammadWorkflow => ({
      ...workflow,
      perform: Object.fromEntries(Object.entries(workflow.perform ?? {}).filter(([key]) => names.has(key))),
    }))
    .filter((workflow) => Object.keys(workflow.perform).length > 0 || workflow.stop_after_match);
  return { screen, role, roleIds, attributes, workflows };
}

export function presentationOf(groupConfig: GroupWizardConfig): FieldPresentation {
  return { fieldHelp: groupConfig.fieldHelp, fieldSteps: groupConfig.fieldSteps, stepTitles: groupConfig.stepTitles };
}

export type ResolvedForm = {
  fields: WizardField[];
  steps: WizardStep[];
  // As respostas que valem: só de campos visíveis, com opções permitidas, e com o padrão do Zammad nos campos
  // ainda não respondidos. Resposta de campo que voltou a ficar oculto sai daqui.
  answers: Answers;
  // Campos somente leitura com valor fixado pelo Zammad: não são perguntados, mas vão no chamado.
  fixed: Record<string, unknown>;
  unsupported: string[];
  skipped: string[];
};

// Limite de rodadas: cada rodada aplica as regras com as respostas que sobraram da anterior (a mesma ideia do
// "rerun" do Zammad). Regras normais estabilizam em 2 ou 3.
const MAX_ROUNDS = 10;

export function resolveForm(rules: FormRules, groupId: number, presentation: FieldPresentation, answers: Answers = {}): ResolvedForm {
  const unsupported = new Set<string>();
  const skipped = new Set<string>();
  let values: Answers = { ...answers };
  let fields: WizardField[] = [];
  let fixed: Record<string, unknown> = {};

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const evaluation = evaluateWorkflows(rules.attributes, rules.workflows, {
      screen: rules.screen,
      ticket: { ...conditionValues(values), group_id: String(groupId) },
      session: { roleIds: rules.roleIds },
      role: rules.role,
    });
    evaluation.unsupported.forEach((message) => unsupported.add(message));
    ({ fields, fixed } = fieldsFrom(rules.attributes, evaluation.fields, presentation, skipped));
    const next = pruneAnswers(fields, values);
    const stable = sameAnswers(next, values);
    values = next;
    if (stable) break;
  }

  const steps = groupIntoSteps(fields, presentation, fieldDependencies(rules.workflows, rules.screen));
  return { fields, steps, answers: values, fixed, unsupported: [...unsupported], skipped: [...skipped] };
}

// Todos os campos que PODEM aparecer no setor (visão do admin): os que aparecem com as respostas vazias e os que
// uma regra condicionada a outra resposta mostra ou torna obrigatórios (`conditional`).
export function sectorFieldCatalog(rules: FormRules, groupId: number, presentation: FieldPresentation): { field: WizardField; conditional: boolean }[] {
  const base = resolveForm(rules, groupId, presentation);
  const seen = new Set(base.fields.map((field) => field.name));
  const context: EvaluationContext = {
    screen: rules.screen,
    ticket: { group_id: String(groupId) },
    session: { roleIds: rules.roleIds },
    role: rules.role,
    assumeFieldConditions: true,
  };
  const extra = new Set<string>();
  for (const workflow of rules.workflows) {
    if (!hasFieldConditions(workflow) || !workflowMatches(workflow, context)) continue;
    for (const [key, action] of Object.entries(workflow.perform ?? {})) {
      const operators = Array.isArray(action.operator) ? action.operator : [action.operator];
      if (operators.some((operator) => operator === "show" || operator === "set_mandatory")) extra.add(key.slice("ticket.".length));
    }
  }
  const conditional: { field: WizardField; conditional: boolean; position: number }[] = [];
  for (const attribute of rules.attributes) {
    if (seen.has(attribute.name) || !extra.has(attribute.name) || ASKED_ONLY_IF_REQUIRED.has(attribute.name)) continue;
    const field = toWizardField(attribute, false, null, null, presentation);
    if (field) conditional.push({ field, conditional: true, position: attribute.position });
  }
  const position = new Map(rules.attributes.map((attribute) => [attribute.name, attribute.position]));
  return [
    ...base.fields.map((field) => ({ field, conditional: false, position: position.get(field.name) ?? 0 })),
    ...conditional,
  ]
    .sort((a, b) => a.position - b.position)
    .map(({ field, conditional: flag }) => ({ field, conditional: flag }));
}

function conditionValues(answers: Answers): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(answers)) {
    if (value !== undefined && value !== null) values[name] = value;
  }
  return values;
}

function fieldsFrom(
  attributes: readonly ZammadAttribute[],
  states: ReturnType<typeof evaluateWorkflows>["fields"],
  presentation: FieldPresentation,
  skipped: Set<string>,
): { fields: WizardField[]; fixed: Record<string, unknown> } {
  const fields: { field: WizardField; position: number }[] = [];
  const fixed: Record<string, unknown> = {};
  for (const attribute of attributes) {
    if (NEVER_ASKED.has(attribute.name)) continue;
    const state = states[attribute.name];
    if (!state?.visible) continue;
    if (ASKED_ONLY_IF_REQUIRED.has(attribute.name) && !state.mandatory) continue;
    if (state.readonly) {
      if (state.fill !== null && state.fill !== undefined && state.fill !== "") fixed[attribute.name] = state.fill;
      continue;
    }
    const field = toWizardField(attribute, state.mandatory, state.allowed, state.fill, presentation);
    if (!field) {
      skipped.add(`${attribute.name} (${attribute.data_type})`);
      continue;
    }
    fields.push({ field, position: attribute.position });
  }
  fields.sort((a, b) => a.position - b.position);
  return { fields: fields.map((entry) => entry.field), fixed };
}

// Respostas que continuam valendo: campo visível, opção permitida; campo ainda não respondido (undefined) recebe o
// padrão do Zammad. `null` = a pessoa limpou a resposta (o padrão não volta).
function pruneAnswers(fields: readonly WizardField[], answers: Answers): Answers {
  const next: Answers = {};
  for (const field of fields) {
    const raw = answers[field.name];
    if (raw === undefined) {
      if (field.defaultValue !== null) next[field.name] = field.defaultValue;
      continue;
    }
    if (raw === null) {
      next[field.name] = null;
      continue;
    }
    if (field.type === "select") {
      if (field.options.some((option) => option.value === raw)) next[field.name] = raw;
      continue;
    }
    if (field.type === "multiselect") {
      const list = (Array.isArray(raw) ? raw : [raw]).map(String).filter((value) => field.options.some((option) => option.value === value));
      if (list.length > 0) next[field.name] = list;
      continue;
    }
    next[field.name] = raw;
  }
  return next;
}

function sameAnswers(a: Answers, b: Answers): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) return false;
    if ((key in a) !== (key in b)) return false;
  }
  return true;
}

export function buildSectorForms(schema: ZammadSchema, config: WizardConfig, options: BuildOptions = {}): BuiltForms {
  const unsupported = new Set<string>();
  const skipped = new Set<string>();
  const sectors: SectorForm[] = [];
  const rules = formRules(schema, options.roleIds ?? [], options.role ?? "ticket.customer");
  // A herança de audiência anda pela árvore inteira (inclusive setores ocultos), por isso usa todos os grupos.
  const tree = schema.groups.map((group) => ({ groupId: group.id, parentId: group.parent_id }));
  // Audiência do PRÓPRIO Zammad: os Core Workflows da máscara de criação que mexem no campo Grupo (ex.:
  // "<Setor> - Cliente" só vê o grupo do setor). Vale para quem pede; admin do plugin vê tudo (prévia).
  const zammadAllowed =
    options.viewer && !options.viewer.isAdmin
      ? groupsAllowedByZammad(schema, options.roleIds ?? [], options.role ?? "ticket.customer", unsupported)
      : null;

  for (const group of schema.groups) {
    if (!group.active) continue;
    const groupConfig = groupConfigFor(config, group.id);
    if (!groupConfig.enabled && !options.includeDisabled) continue;
    if (options.viewer && !isSectorVisible(group.id, tree, config, options.viewer)) continue;
    if (zammadAllowed && !zammadAllowed.has(group.id)) continue;
    const form = buildSectorForm(rules, group, groupConfig, unsupported, skipped);
    sectors.push(form);
  }

  sectors.sort(compareSectors);
  return { sectors, rules, unsupported: [...unsupported], skippedFields: [...skipped] };
}

// Grupos que o Zammad deixa a pessoa escolher, já expandidos pela árvore: liberar um setor libera as
// subcategorias dele (convenção "<Setor>" + "<Setor>::*"), e o pai de uma subcategoria liberada aparece
// para a pessoa navegar até ela. null = o Zammad não restringe.
export function groupsAllowedByZammad(
  schema: ZammadSchema,
  roleIds: number[],
  role: EvaluationContext["role"],
  unsupported?: Set<string>,
): Set<number> | null {
  const result = allowedGroupIds(schema.workflows, { screen: "create_middle", session: { roleIds }, role }, schema.groups.map((group) => String(group.id)));
  result.unsupported.forEach((message) => unsupported?.add(message));
  if (result.allowed === null) return null;
  const direct = new Set(result.allowed.map(Number));
  const parentOf = new Map(schema.groups.map((group) => [group.id, group.parent_id]));
  const ancestors = (id: number): number[] => {
    const out: number[] = [];
    const seen = new Set<number>();
    let current = parentOf.get(id) ?? null;
    while (current !== null && !seen.has(current)) {
      seen.add(current);
      out.push(current);
      current = parentOf.get(current) ?? null;
    }
    return out;
  };
  const visible = new Set<number>();
  for (const group of schema.groups) {
    const chain = ancestors(group.id);
    if (direct.has(group.id) || chain.some((id) => direct.has(id))) {
      visible.add(group.id);
      chain.forEach((id) => visible.add(id));
    }
  }
  return visible;
}

function compareSectors(a: SectorForm, b: SectorForm): number {
  const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB || a.label.localeCompare(b.label, "pt-BR");
}

function buildSectorForm(
  rules: FormRules,
  group: ZammadGroup,
  groupConfig: GroupWizardConfig,
  unsupported: Set<string>,
  skipped: Set<string>,
): SectorForm {
  const presentation = presentationOf(groupConfig);
  const resolved = resolveForm(rules, group.id, presentation);
  resolved.unsupported.forEach((message) => unsupported.add(message));
  resolved.skipped.forEach((name) => skipped.add(name));

  return {
    groupId: group.id,
    parentId: group.parent_id,
    label: groupConfig.label?.trim() || group.name_last || group.name,
    description: groupConfig.description?.trim() || group.note?.trim() || null,
    bodyHint: groupConfig.bodyHint?.trim() || null,
    order: groupConfig.order,
    steps: resolved.steps,
    presentation,
  };
}

const isChoice = (field: WizardField) => field.type === "select" || field.type === "multiselect";
const isDate = (field: WizardField) => field.type === "date" || field.type === "datetime";
const QUICK_PER_STEP = 3;
const OPTIONAL_PER_STEP = 4;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function makeStep(key: string, title: string, fields: WizardField[]): WizardStep {
  return { key, title, fields, optional: fields.every((field) => !field.required) };
}

// Etapas automáticas (campos sem número de etapa configurado). Pensadas para o menor número de telas
// sem sobrecarregar nenhuma: cada pergunta de ESCOLHA fica sozinha (opções precisam de espaço), as
// datas vão juntas, as perguntas rápidas (sim/não, texto curto…) vão em lotes de 3 e TUDO que é
// opcional fica numa etapa só, no fim — a pessoa nunca trava numa pergunta que pode pular.
function autoSteps(fields: WizardField[], prefix = "auto"): WizardStep[] {
  const required = fields.filter((field) => field.required);
  const optional = fields.filter((field) => !field.required);
  const steps: WizardStep[] = [];
  let counter = 0;
  const next = () => `${prefix}-${(counter += 1)}`;

  for (const field of required.filter(isChoice)) steps.push(makeStep(next(), field.label, [field]));
  const dates = required.filter(isDate);
  if (dates.length > 0) steps.push(makeStep(next(), dates.length === 1 ? dates[0].label : "Para quando?", dates));
  for (const group of chunk(required.filter((field) => !isChoice(field) && !isDate(field)), QUICK_PER_STEP)) {
    steps.push(makeStep(next(), group.length === 1 ? group[0].label : "Só mais algumas perguntas", group));
  }
  for (const group of chunk(optional, OPTIONAL_PER_STEP)) {
    steps.push(makeStep(next(), group.every(isDate) ? "Alguma data de preferência?" : "Quer ajustar mais alguma coisa?", group));
  }
  return steps;
}

// Campos com número de etapa na configuração do admin vêm primeiro (na ordem dos números); os demais
// seguem a regra automática. Campo CONDICIONAL (sem número de etapa e liberado por outra resposta, ex.:
// ferramenta_portal ← sistema_afetado) entra na mesma etapa do campo que o libera: aparece logo abaixo dele, na
// hora da escolha, e as outras etapas não mudam de lugar.
function groupIntoSteps(fields: WizardField[], presentation: FieldPresentation, dependencies: Map<string, Set<string>> = new Map()): WizardStep[] {
  const names = new Set(fields.map((field) => field.name));
  const controllerOf = new Map<string, string>();
  for (const field of fields) {
    if (presentation.fieldSteps[field.name] !== undefined) continue;
    const sources = dependencies.get(field.name);
    const controller = sources ? [...sources].find((source) => names.has(source)) : undefined;
    if (controller) controllerOf.set(field.name, controller);
  }

  const base = fields.filter((field) => !controllerOf.has(field.name));
  const configured = new Map<number, WizardField[]>();
  const rest: WizardField[] = [];
  for (const field of base) {
    const number = presentation.fieldSteps[field.name];
    if (number === undefined) rest.push(field);
    else configured.set(number, [...(configured.get(number) ?? []), field]);
  }
  const manual = [...configured.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, stepFields]) =>
      makeStep(`step-${number}`, presentation.stepTitles[String(number)]?.trim() || (stepFields.length === 1 ? stepFields[0].label : "Mais alguns detalhes"), stepFields),
    );
  const steps = [...manual, ...autoSteps(rest)];

  // Encaixa os dependentes (inclusive dependente de dependente); ciclo ou controlador sumido vai para o fim.
  let pending = fields.filter((field) => controllerOf.has(field.name));
  let progressed = true;
  while (pending.length > 0 && progressed) {
    progressed = false;
    pending = pending.filter((field) => {
      const controller = controllerOf.get(field.name);
      const step = steps.find((candidate) => candidate.fields.some((other) => other.name === controller));
      if (!step) return true;
      const at = step.fields.findIndex((other) => other.name === controller);
      // Logo depois do controlador e dos dependentes dele já encaixados.
      let insert = at + 1;
      while (insert < step.fields.length && controllerOf.get(step.fields[insert].name) === controller) insert += 1;
      step.fields.splice(insert, 0, field);
      progressed = true;
      return false;
    });
  }
  if (pending.length > 0) steps.push(...autoSteps(pending, "cond"));
  return steps.map((step) => ({ ...step, optional: step.fields.every((field) => !field.required) }));
}

function fieldType(attribute: ZammadAttribute): FieldType | null {
  const option = attribute.data_option;
  switch (attribute.data_type) {
    case "select":
    case "tree_select":
      return option.multiple === true ? "multiselect" : "select";
    case "multiselect":
    case "multi_tree_select":
      return "multiselect";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "input":
      // Campo de e-mail do Zammad (data_option.type = "email"): validado como e-mail, não como texto solto.
      return option.type === "email" ? "email" : "text";
    case "textarea":
      return "textarea";
    case "integer":
      return "integer";
    default:
      return null;
  }
}

function toWizardField(
  attribute: ZammadAttribute,
  required: boolean,
  allowed: string[] | null,
  fill: unknown,
  presentation: FieldPresentation,
): WizardField | null {
  const type = fieldType(attribute);
  if (!type) return null;
  const option = attribute.data_option;

  let options: { value: string; label: string }[] = [];
  if (type === "select" || type === "multiselect") {
    options = flattenOptions(option.options);
    if (allowed) options = options.filter((entry) => allowed.includes(entry.value));
    // Lista numerada (ex.: prioridade sugerida "1 Baixa" … "4 Urgente"): o número é só a ordem no Zammad.
    options = stripNumbersFromOptions(options);
  } else if (type === "boolean") {
    const labels = (option.options ?? {}) as Record<string, unknown>;
    options = [
      { value: "true", label: String(labels.true ?? "Sim") },
      { value: "false", label: String(labels.false ?? "Não") },
    ];
  }

  return {
    name: attribute.name,
    label: attribute.display,
    type,
    required,
    options,
    help: presentation.fieldHelp[attribute.name]?.trim() || null,
    maxLength: typeof option.maxlength === "number" ? option.maxlength : null,
    // Zammad: future/past ausentes = ambos permitidos.
    allowFuture: option.future !== false,
    allowPast: option.past !== false,
    defaultValue: defaultFor(type, fill ?? option.default, options),
  };
}

function defaultFor(type: FieldType, raw: unknown, options: { value: string }[]): AnswerValue | null {
  if (raw === undefined || raw === null || raw === "") return null;
  // Sim/Não nunca vem marcado: a pessoa precisa responder (o padrão `false` do Zammad viraria "não"
  // sem ninguém ter lido a pergunta).
  if (type === "boolean") return null;
  if (type === "multiselect") {
    const list = (Array.isArray(raw) ? raw : [raw]).map(String).filter((value) => options.some((o) => o.value === value));
    return list.length > 0 ? list : null;
  }
  if (type === "select") {
    const value = String(Array.isArray(raw) ? raw[0] : raw);
    return options.some((o) => o.value === value) ? value : null;
  }
  if (type === "integer") return typeof raw === "number" ? raw : null;
  return typeof raw === "string" ? raw : null;
}
