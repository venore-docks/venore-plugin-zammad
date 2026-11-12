import type { AnswerValue, FieldType, GroupWizardConfig, SectorForm, WizardConfig, WizardField, WizardStep } from "../contracts/types";
import type { ZammadAttribute, ZammadGroup, ZammadSchema } from "../contracts/zammad";
import { DEFAULT_AUDIENCE, isSectorVisible, type AudienceViewer } from "./audience";
import { evaluateWorkflows, flattenOptions, type EvaluationContext } from "./workflow";

// Monta o formulário em etapas de cada setor (= grupo do Zammad) a partir do schema do Zammad e da
// configuração de apresentação. Puro: os testes rodam contra o recorte real em __fixtures__.

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

export type BuiltForms = { sectors: SectorForm[]; unsupported: string[]; skippedFields: string[] };

export function buildSectorForms(schema: ZammadSchema, config: WizardConfig, options: BuildOptions = {}): BuiltForms {
  const unsupported = new Set<string>();
  const skipped = new Set<string>();
  const sectors: SectorForm[] = [];
  // A herança de audiência anda pela árvore inteira (inclusive setores ocultos), por isso usa todos os grupos.
  const tree = schema.groups.map((group) => ({ groupId: group.id, parentId: group.parent_id }));

  for (const group of schema.groups) {
    if (!group.active) continue;
    const groupConfig = groupConfigFor(config, group.id);
    if (!groupConfig.enabled && !options.includeDisabled) continue;
    if (options.viewer && !isSectorVisible(group.id, tree, config, options.viewer)) continue;
    const form = buildSectorForm(schema, group, groupConfig, options, unsupported, skipped);
    sectors.push(form);
  }

  sectors.sort(compareSectors);
  return { sectors, unsupported: [...unsupported], skippedFields: [...skipped] };
}

function compareSectors(a: SectorForm, b: SectorForm): number {
  const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB || a.label.localeCompare(b.label, "pt-BR");
}

function buildSectorForm(
  schema: ZammadSchema,
  group: ZammadGroup,
  groupConfig: GroupWizardConfig,
  options: BuildOptions,
  unsupported: Set<string>,
  skipped: Set<string>,
): SectorForm {
  const evaluation = evaluateWorkflows(schema.attributes, schema.workflows, {
    screen: "create_middle",
    ticket: { group_id: String(group.id) },
    session: { roleIds: options.roleIds ?? [] },
    role: options.role ?? "ticket.customer",
  });
  evaluation.unsupported.forEach((message) => unsupported.add(message));

  const fields: { field: WizardField; position: number }[] = [];
  for (const attribute of schema.attributes) {
    const state = evaluation.fields[attribute.name];
    if (!state?.visible) continue;
    const field = toWizardField(attribute, state.mandatory, state.allowed, state.fill, groupConfig);
    if (!field) {
      skipped.add(`${attribute.name} (${attribute.data_type})`);
      continue;
    }
    fields.push({ field, position: attribute.position });
  }
  fields.sort((a, b) => a.position - b.position);

  return {
    groupId: group.id,
    parentId: group.parent_id,
    label: groupConfig.label?.trim() || group.name_last || group.name,
    description: groupConfig.description?.trim() || group.note?.trim() || null,
    bodyHint: groupConfig.bodyHint?.trim() || null,
    order: groupConfig.order,
    steps: groupIntoSteps(
      fields.map((entry) => entry.field),
      groupConfig,
    ),
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
function autoSteps(fields: WizardField[]): WizardStep[] {
  const required = fields.filter((field) => field.required);
  const optional = fields.filter((field) => !field.required);
  const steps: WizardStep[] = [];
  let counter = 0;
  const next = () => `auto-${(counter += 1)}`;

  for (const field of required.filter(isChoice)) steps.push(makeStep(next(), field.label, [field]));
  const dates = required.filter(isDate);
  if (dates.length > 0) steps.push(makeStep(next(), dates.length === 1 ? dates[0].label : "Para quando?", dates));
  for (const group of chunk(required.filter((field) => !isChoice(field) && !isDate(field)), QUICK_PER_STEP)) {
    steps.push(makeStep(next(), group.length === 1 ? group[0].label : "Só mais algumas perguntas", group));
  }
  for (const group of chunk(optional, OPTIONAL_PER_STEP)) steps.push(makeStep(next(), "Quer ajustar mais alguma coisa?", group));
  return steps;
}

// Campos com número de etapa na configuração do admin vêm primeiro (na ordem dos números); os demais
// seguem a regra automática.
function groupIntoSteps(fields: WizardField[], groupConfig: GroupWizardConfig): WizardStep[] {
  const configured = new Map<number, WizardField[]>();
  const rest: WizardField[] = [];
  for (const field of fields) {
    const number = groupConfig.fieldSteps[field.name];
    if (number === undefined) rest.push(field);
    else configured.set(number, [...(configured.get(number) ?? []), field]);
  }
  const manual = [...configured.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, stepFields]) =>
      makeStep(`step-${number}`, groupConfig.stepTitles[String(number)]?.trim() || (stepFields.length === 1 ? stepFields[0].label : "Mais alguns detalhes"), stepFields),
    );
  return [...manual, ...autoSteps(rest)];
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
      return "text";
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
  groupConfig: GroupWizardConfig,
): WizardField | null {
  const type = fieldType(attribute);
  if (!type) return null;
  const option = attribute.data_option;

  let options: { value: string; label: string }[] = [];
  if (type === "select" || type === "multiselect") {
    options = flattenOptions(option.options);
    if (allowed) options = options.filter((entry) => allowed.includes(entry.value));
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
    help: groupConfig.fieldHelp[attribute.name]?.trim() || null,
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
