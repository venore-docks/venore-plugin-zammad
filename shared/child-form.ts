import type { AnswerValue, FieldPresentation, FormRules, WizardConfig, WizardField } from "../contracts/types";
import type { ZammadGroup, ZammadSchema } from "../contracts/zammad";
import { isEmptyAnswer, localNow, validateField, type Answers } from "./answers";
import { buildSectorForms, resolveForm, type ResolvedForm } from "./form";

// Formulário do chamado filho: os campos do setor que vai RECEBER o filho, lidos do schema e dos Core Workflows do
// Zammad (como na abertura). Puro: testado em child-form.test.ts contra o recorte real em __fixtures__.
//
// Diferenças em relação à abertura pelo solicitante:
//   - papel `ticket.agent`: o filho é criado em nome de um agente/gestor (`X-On-Behalf-Of`), não de um cliente;
//   - setores ocultos no wizard também valem (`includeDisabled`): o filho é interno da equipe;
//   - sem `viewer`: a audiência dos setores é do solicitante final, não da equipe que pede a outro setor.
// Os campos que ninguém responde na abertura (NEVER_ASKED) continuam fora.

export type ChildFormContext = { roleIds: number[] };
// `fields` = com as respostas vazias; `rules`/`presentation` reavaliam com as respostas (`resolveForm`): campos
// condicionados a outra resposta entram e saem como na abertura.
export type ChildForm = { groupId: number; label: string; fields: WizardField[]; rules: FormRules; presentation: FieldPresentation };

export const SUBJECT_REQUIRED_PREFIX = "Escolha o assunto em";

// Setor que tem subgrupos ativos: o filho vai para um dos subgrupos (o assunto), nunca para o pai.
export function hasActiveSubgroups(groups: readonly ZammadGroup[], groupId: number): boolean {
  return groups.some((group) => group.active && group.parent_id === groupId);
}

export function subjectRequiredMessage(groups: readonly ZammadGroup[], groupId: number): string {
  const group = groups.find((candidate) => candidate.id === groupId);
  const label = group ? (group.name_last ?? group.name.split("::").pop() ?? group.name).trim() : "este setor";
  return `${SUBJECT_REQUIRED_PREFIX} ${label} para continuar.`;
}

export function buildChildForm(schema: ZammadSchema, config: WizardConfig, groupId: number, context: ChildFormContext): ChildForm | null {
  const { sectors, rules } = buildSectorForms(schema, config, { roleIds: context.roleIds, role: "ticket.agent", includeDisabled: true });
  const sector = sectors.find((candidate) => candidate.groupId === groupId);
  if (!sector) return null;
  return { groupId: sector.groupId, label: sector.label, fields: sector.steps.flatMap((step) => step.fields), rules, presentation: sector.presentation };
}

// Respostas iniciais já com os campos condicionais: o valor herdado do pai pode liberar outro campo (ex.: pai com
// sistema_afetado = portal libera ferramenta_portal, que também é herdada). Duas passadas bastam para um nível.
export function resolvedChildDefaults(form: ChildForm, parent: Record<string, unknown>, now: Date = new Date()): ResolvedForm {
  let answers = childDefaults(form.fields, parent, now);
  let resolved = resolveForm(form.rules, form.groupId, form.presentation, answers);
  for (let pass = 0; pass < 2; pass += 1) {
    answers = { ...childDefaults(resolved.fields, parent, now), ...resolved.answers };
    resolved = resolveForm(form.rules, form.groupId, form.presentation, answers);
  }
  return resolved;
}

// Respostas iniciais: o padrão do Zammad e, por cima, o valor que o chamado PAI já tem no mesmo campo (ex.: o
// local físico). Só entra valor que passaria na validação (opção que existe, data dentro da janela…), no formato
// do wizard: data "YYYY-MM-DD", data e hora "YYYY-MM-DDTHH:mm" em UTC-3, múltipla escolha como lista.
// Sim/Não nunca é herdado: a pessoa responde de fato (o Zammad grava `false` em campo que ninguém respondeu).
export function childDefaults(fields: readonly WizardField[], parent: Record<string, unknown>, now: Date = new Date()): Answers {
  const answers: Answers = {};
  for (const field of fields) {
    if (field.defaultValue !== null) answers[field.name] = field.defaultValue;
    const inherited = toAnswer(field, parent[field.name]);
    if (inherited === null) continue;
    if (validateField(field, inherited, now) !== null) continue;
    answers[field.name] = inherited;
  }
  return answers;
}

function toAnswer(field: WizardField, raw: unknown): AnswerValue | null {
  if (raw === undefined || raw === null || raw === "") return null;
  switch (field.type) {
    case "boolean":
      return null;
    case "multiselect": {
      const list = (Array.isArray(raw) ? raw : [raw]).map(String).filter((value) => value.trim() !== "");
      return list.length > 0 ? list : null;
    }
    case "select":
      return Array.isArray(raw) ? (raw.length > 0 ? String(raw[0]) : null) : String(raw);
    case "integer": {
      const value = typeof raw === "number" ? raw : Number(raw);
      return Number.isInteger(value) ? value : null;
    }
    case "date":
      return typeof raw === "string" ? raw.slice(0, 10) : null;
    case "datetime": {
      if (typeof raw !== "string") return null;
      const instant = new Date(raw);
      return Number.isNaN(instant.getTime()) ? null : localNow(instant);
    }
    case "text":
    case "email":
    case "textarea": {
      const value = typeof raw === "string" ? raw : String(raw);
      return isEmptyAnswer(value) ? null : value;
    }
  }
}
