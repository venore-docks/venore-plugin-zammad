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

// Padrão quando o administrador não definiu (decisão de 27/11/2026): 1 dia útil. Devolve a CHAVE exata da opção
// do Zammad (as chaves podem ter espaço no fim, como "3d "; a comparação é sem espaços, o envio é a chave exata).
export const DEFAULT_ESTIMATE = "1d";

export function findEstimateKey(options: readonly EstimateOption[], wanted: string): string | null {
  return options.find((option) => option.value.trim() === wanted.trim())?.value ?? null;
}

// Duração útil de uma chave de tempo previsto: "30m", "2h", "1d", "1sem"… Horas/minutos = horas úteis; dias =
// jornadas de um dia útil do calendário; semana = 5 dias úteis. null = chave que não segue o padrão.
export function estimateSeconds(key: string, businessDaySeconds: number): number | null {
  const match = /^(\d+)\s*(m|min|h|d|sem)$/i.exec(key.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  switch (match[2].toLowerCase()) {
    case "m":
    case "min":
      return amount * 60;
    case "h":
      return amount * 3600;
    case "d":
      return amount * businessDaySeconds;
    default:
      return amount * 5 * businessDaySeconds;
  }
}

// Valor vindo do navegador: "" ou null = limpar; senão precisa ser uma das opções.
export function parseEstimate(options: readonly EstimateOption[], value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  const key = String(value);
  return options.some((option) => option.value === key) ? { ok: true, value: key } : { ok: false };
}
