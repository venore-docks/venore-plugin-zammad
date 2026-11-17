import type { FlowStepKey } from "../contracts/types";

// Fila do gestor separada por etapa do fluxo da FEM. Puro: testado em queue-buckets.test.ts.
//   novo / analise / autorizado / nao_autorizado / reavaliacao  = a decisão é do gestor (qualquer responsável)
//   atribuidos                                               = já está com um agente (Em andamento, Concluído…)
// Chamado fora do fluxo (Zammad sem esses estados) sem responsável cai em "novo"; com responsável, em "atribuidos".

export type QueueBucket = "novo" | "analise" | "autorizado" | "nao_autorizado" | "reavaliacao" | "atribuidos";

export const QUEUE_BUCKETS: { key: QueueBucket; label: string; hint: string }[] = [
  { key: "novo", label: "Novo", hint: "Pedidos que chegaram e ainda não foram analisados." },
  { key: "analise", label: "Em análise", hint: "Pedidos que você começou a analisar." },
  { key: "reavaliacao", label: "Reavaliação", hint: "Pedidos não autorizados que o solicitante reenviou." },
  { key: "autorizado", label: "Autorizado", hint: "Autorizados, esperando um responsável." },
  { key: "nao_autorizado", label: "Não autorizado", hint: "Negados. O solicitante pode reenviar com explicação." },
  { key: "atribuidos", label: "Atribuídos", hint: "Chamados que já estão com um agente." },
];

const BY_STEP: Partial<Record<FlowStepKey, QueueBucket>> = {
  novo: "novo",
  em_analise: "analise",
  autorizado: "autorizado",
  nao_autorizado: "nao_autorizado",
  reavaliacao: "reavaliacao",
};

export function bucketOf(step: FlowStepKey | null, hasOwner: boolean): QueueBucket | null {
  if (step && BY_STEP[step]) return BY_STEP[step] ?? null;
  if (step === "finalizado") return null;
  return hasOwner ? "atribuidos" : step === null ? "novo" : "atribuidos";
}

export function parseBucket(value: string | string[] | undefined): QueueBucket | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const key = raw === "nao-autorizado" ? "nao_autorizado" : raw;
  return QUEUE_BUCKETS.some((bucket) => bucket.key === key) ? (key as QueueBucket) : undefined;
}

// Na URL o "_" vira "-" (?etapa=nao-autorizado).
export function bucketParam(bucket: QueueBucket): string {
  return bucket.replace("_", "-");
}

export function countBuckets<T extends { bucket: QueueBucket }>(items: readonly T[]): Record<QueueBucket, number> {
  const counts: Record<QueueBucket, number> = { novo: 0, analise: 0, autorizado: 0, nao_autorizado: 0, reavaliacao: 0, atribuidos: 0 };
  for (const item of items) counts[item.bucket] += 1;
  return counts;
}

// Aba aberta sem ?etapa: a primeira que pede decisão e tem chamado; senão "Novo".
export function defaultBucket(counts: Record<QueueBucket, number>): QueueBucket {
  const order: QueueBucket[] = ["novo", "reavaliacao", "analise", "autorizado"];
  return order.find((bucket) => counts[bucket] > 0) ?? "novo";
}

// O que pede ação do gestor agora (o número no menu "Fila").
export function pendingDecisions(counts: Record<QueueBucket, number>): number {
  return counts.novo + counts.analise + counts.reavaliacao + counts.autorizado;
}
