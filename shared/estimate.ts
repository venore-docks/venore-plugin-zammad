import type { ZammadAttribute } from "../contracts/zammad";
import { flattenOptions } from "./workflow";

// Tempo previsto do chamado: campo customizado do Zammad da FEM (`tempo_previsto`, seleção 1 h … 2 semanas),
// definido pelo administrador do setor e visto por todos (solicitante, agente, gestor). As opções vêm do próprio
// Zammad (o plugin não duplica a lista). Puro: testado em estimate.test.ts.
export const ESTIMATE_FIELD = "tempo_previsto";

export type EstimateOption = { value: string; label: string };

// Opções do campo, ou null quando o Zammad não tem o campo (ou ele está desativado): a função some do portal.
export function estimateOptions(attributes: readonly ZammadAttribute[]): EstimateOption[] | null {
  const attribute = attributes.find((candidate) => candidate.object === "Ticket" && candidate.name === ESTIMATE_FIELD);
  if (!attribute || !attribute.active) return null;
  return flattenOptions(attribute.data_option?.options).filter((option) => option.value !== "");
}

export function estimateLabel(options: readonly EstimateOption[], value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const key = String(value);
  return options.find((option) => option.value === key)?.label ?? key;
}

// Valor vindo do navegador: "" ou null = limpar; senão precisa ser uma das opções.
export function parseEstimate(options: readonly EstimateOption[], value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  const key = String(value);
  return options.some((option) => option.value === key) ? { ok: true, value: key } : { ok: false };
}
