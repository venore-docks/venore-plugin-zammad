import type { FlowStepKey } from "../contracts/types";

// Fila do gestor separada por etapa do fluxo da FEM: uma aba por estado, na ordem do fluxo (v1.9.0 — antes os
// estados com agente ficavam juntos em "Atribuídos"). Puro: testado em queue-buckets.test.ts.
//   novo / analise / reavaliacao / autorizado   a decisão é do gestor
//   atribuido / andamento / concluido           com um agente (Atribuído espera o agente iniciar)
//   nao_autorizado / finalizado                 encerrados (Não autorizado espera o solicitante reenviar)
// Chamado fora do fluxo (Zammad sem esses estados): aberto sem responsável cai em "novo"; aberto com responsável,
// em "andamento"; encerrado fica fora da fila.

export type QueueBucket =
  | "novo"
  | "analise"
  | "reavaliacao"
  | "autorizado"
  | "atribuido"
  | "andamento"
  | "concluido"
  | "nao_autorizado"
  | "finalizado";

export const QUEUE_BUCKETS: { key: QueueBucket; label: string; hint: string }[] = [
  { key: "novo", label: "Novo", hint: "Pedidos que chegaram e ainda não foram analisados." },
  { key: "analise", label: "Em análise", hint: "Pedidos que você começou a analisar." },
  { key: "reavaliacao", label: "Reavaliação", hint: "Pedidos não autorizados que o solicitante reenviou." },
  { key: "autorizado", label: "Autorizado", hint: "Autorizados, esperando um responsável." },
  { key: "atribuido", label: "Atribuído", hint: "Com um responsável, que ainda não iniciou o atendimento." },
  { key: "andamento", label: "Em andamento", hint: "Um agente está trabalhando no pedido." },
  { key: "concluido", label: "Concluído", hint: "Entregues, esperando o solicitante aprovar ou pedir ajustes." },
  { key: "nao_autorizado", label: "Não autorizado", hint: "Negados. O solicitante pode reenviar com explicação." },
  { key: "finalizado", label: "Finalizado", hint: "Os 50 encerrados mais recentes dos seus setores." },
];

const BY_STEP: Record<FlowStepKey, QueueBucket> = {
  novo: "novo",
  em_analise: "analise",
  reavaliacao: "reavaliacao",
  autorizado: "autorizado",
  atribuido: "atribuido",
  em_andamento: "andamento",
  concluido: "concluido",
  nao_autorizado: "nao_autorizado",
  finalizado: "finalizado",
};

// `closed`: só importa fora do fluxo (estado genérico encerrado fica fora da fila).
export function bucketOf(step: FlowStepKey | null, hasOwner: boolean, closed = false): QueueBucket | null {
  if (step) return BY_STEP[step];
  if (closed) return null;
  return hasOwner ? "andamento" : "novo";
}

// Endereços antigos: ?etapa=atribuidos (aba que juntava os estados com agente) abre "Em andamento".
const LEGACY_PARAMS: Record<string, QueueBucket> = { atribuidos: "andamento", "nao-autorizado": "nao_autorizado" };

export function parseBucket(value: string | string[] | undefined): QueueBucket | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const key = LEGACY_PARAMS[raw] ?? raw;
  return QUEUE_BUCKETS.some((bucket) => bucket.key === key) ? (key as QueueBucket) : undefined;
}

// Na URL o "_" vira "-" (?etapa=nao-autorizado).
export function bucketParam(bucket: QueueBucket): string {
  return bucket.replace("_", "-");
}

export function emptyCounts(): Record<QueueBucket, number> {
  return Object.fromEntries(QUEUE_BUCKETS.map((bucket) => [bucket.key, 0])) as Record<QueueBucket, number>;
}

export function countBuckets<T extends { bucket: QueueBucket }>(items: readonly T[]): Record<QueueBucket, number> {
  const counts = emptyCounts();
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
