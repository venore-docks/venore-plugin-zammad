import type { AnswerValue, AttachmentLimits, WizardField } from "../contracts/types";

// Validação e conversão das respostas. Pura e sem dependência de servidor: o wizard usa as mesmas
// regras para validar cada etapa antes de avançar, e o servidor revalida tudo antes de mandar ao Zammad.

// Fuso das datas/horas digitadas. O Brasil não tem horário de verão desde 2019; as unidades da FEM
// estão em UTC-3. `datetime-local` do navegador não carrega fuso, então o offset é fixo aqui.
export const LOCAL_UTC_OFFSET = "-03:00";

export const TITLE_MIN = 5;
export const TITLE_MAX = 200;
export const DESCRIPTION_MIN = 15;
export const DESCRIPTION_MAX = 20000;

// Server action do core aceita até 10 MB (next.config `serverActions.bodySizeLimit`): 8 MB de
// arquivos deixam folga para o resto do formulário.
export const ATTACHMENT_LIMITS: AttachmentLimits = { maxFiles: 5, maxTotalBytes: 8 * 1024 * 1024 };

export type Answers = Record<string, AnswerValue | null | undefined>;

export function isEmptyAnswer(value: AnswerValue | null | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// "Agora" em UTC-3, como "YYYY-MM-DDTHH:mm" — comparável com o que o datetime-local devolve.
export function localNow(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export function validateField(field: WizardField, value: AnswerValue | null | undefined, now: Date = new Date()): string | null {
  if (isEmptyAnswer(value)) return field.required ? "Responda esta pergunta para continuar." : null;

  switch (field.type) {
    case "select":
      return typeof value === "string" && field.options.some((o) => o.value === value) ? null : "Escolha uma das opções.";
    case "multiselect":
      return Array.isArray(value) && value.every((item) => field.options.some((o) => o.value === item))
        ? null
        : "Escolha entre as opções listadas.";
    case "boolean":
      return typeof value === "boolean" ? null : "Responda sim ou não.";
    case "integer":
      return typeof value === "number" && Number.isInteger(value) ? null : "Informe um número inteiro.";
    case "text":
    case "textarea":
      if (typeof value !== "string") return "Resposta inválida.";
      if (field.maxLength && value.trim().length > field.maxLength) return `Use no máximo ${field.maxLength} caracteres.`;
      return null;
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Informe uma data válida.";
      return checkTimeWindow(field, value, localNow(now).slice(0, 10));
    }
    case "datetime": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "Informe data e hora.";
      return checkTimeWindow(field, value, localNow(now));
    }
  }
}

function checkTimeWindow(field: WizardField, value: string, now: string): string | null {
  if (!field.allowPast && value < now) return "A data precisa ser no futuro.";
  if (!field.allowFuture && value > now) return "A data não pode ser no futuro.";
  return null;
}

export function validateFields(fields: WizardField[], answers: Answers, now: Date = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = validateField(field, answers[field.name], now);
    if (error) errors[field.name] = error;
  }
  return errors;
}

export function validateTitle(title: string): string | null {
  const length = title.trim().length;
  if (length < TITLE_MIN) return `Escreva um título com pelo menos ${TITLE_MIN} caracteres.`;
  if (length > TITLE_MAX) return `O título pode ter no máximo ${TITLE_MAX} caracteres.`;
  return null;
}

export function validateDescription(description: string): string | null {
  const length = description.trim().length;
  if (length < DESCRIPTION_MIN) return "Conte um pouco mais — pelo menos uma frase completa ajuda a equipe a entender o pedido.";
  if (length > DESCRIPTION_MAX) return "A descrição está longa demais. Anexe um arquivo com os detalhes.";
  return null;
}

export function validateAttachments(files: { size: number }[], limits: AttachmentLimits = ATTACHMENT_LIMITS): string | null {
  if (files.length > limits.maxFiles) return `Anexe no máximo ${limits.maxFiles} arquivos.`;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > limits.maxTotalBytes) return `Os anexos somam ${formatBytes(total)}; o limite é ${formatBytes(limits.maxTotalBytes)}.`;
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// Valor no formato que a API de ticket do Zammad grava. Campos vazios não vão.
export function toZammadValues(fields: WizardField[], answers: Answers): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = answers[field.name];
    if (isEmptyAnswer(value)) continue;
    values[field.name] = field.type === "datetime" ? `${value}:00${LOCAL_UTC_OFFSET}` : value;
  }
  return values;
}

// Texto legível de uma resposta (revisão no wizard e resumo no corpo do chamado).
export function displayAnswer(field: WizardField, value: AnswerValue | null | undefined): string {
  if (isEmptyAnswer(value)) return "—";
  const labelOf = (option: string) => field.options.find((o) => o.value === option)?.label ?? option;
  switch (field.type) {
    case "select":
      return labelOf(String(value));
    case "multiselect":
      return (value as string[]).map(labelOf).join(", ");
    case "boolean":
      return labelOf(String(value));
    case "date": {
      const [y, m, d] = String(value).split("-");
      return `${d}/${m}/${y}`;
    }
    case "datetime": {
      const [date, time] = String(value).split("T");
      const [y, m, d] = date.split("-");
      return `${d}/${m}/${y} às ${time}`;
    }
    default:
      return String(value);
  }
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Corpo do 1º artigo: a descrição da pessoa + um resumo das respostas (os campos também vão como
// atributos do ticket, mas o resumo é o que aparece no e-mail de notificação dos agentes).
export function composeBody(description: string, fields: WizardField[], answers: Answers, origin: string): string {
  const paragraphs = description
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
  const answered = fields.filter((field) => !isEmptyAnswer(answers[field.name]));
  const summary =
    answered.length === 0
      ? ""
      : `<hr><p><strong>Respostas do formulário</strong></p><ul>${answered
          .map((field) => `<li><strong>${escapeHtml(field.label)}</strong>: ${escapeHtml(displayAnswer(field, answers[field.name]))}</li>`)
          .join("")}</ul>`;
  return `${paragraphs}${summary}<p><em>${escapeHtml(origin)}</em></p>`;
}
