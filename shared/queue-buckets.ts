import type { FlowStepKey, TicketStateColor } from "../contracts/types";

// Fila do gestor: a aba "Em aberto" (todos os chamados abertos, agrupados por etapa) e uma aba por estado, na ordem do
// fluxo: Novo → Em análise → Autorizado | Não autorizado (→ Reavaliação) → Atribuído → Em andamento → Concluído →
// Finalizado. Só Finalizado é encerrado de verdade. Puro: testado em queue-buckets.test.ts.
//   novo / analise / autorizado / reavaliacao   a decisão é do gestor
//   nao_autorizado                              espera o solicitante reenviar
//   atribuido / andamento / pausa / concluido   com um agente (Atribuído espera o agente iniciar; Em pausa, retomar)
//   finalizado                                  encerrado
// Chamado fora do fluxo (Zammad sem esses estados): aberto sem responsável cai em "novo"; aberto com responsável,
// em "andamento"; encerrado fica fora da fila.

// As etapas (uma por estado) e a aba que reúne todas as abertas.
export type StageBucket =
  | "novo"
  | "analise"
  | "autorizado"
  | "nao_autorizado"
  | "reavaliacao"
  | "atribuido"
  | "andamento"
  | "pausa"
  | "aguardando"
  | "concluido"
  | "finalizado"
  | "outros";
export type QueueBucket = "abertos" | StageBucket;

export const OPEN_TAB: QueueBucket = "abertos";

type BucketInfo = { key: QueueBucket; label: string; hint: string };

export const QUEUE_BUCKETS: BucketInfo[] = [
  { key: "abertos", label: "Em aberto", hint: "Todos os chamados abertos dos seus setores, por etapa." },
  { key: "novo", label: "Novo", hint: "Pedidos que chegaram e ainda não foram analisados." },
  { key: "analise", label: "Em análise", hint: "Pedidos que você começou a analisar." },
  { key: "autorizado", label: "Autorizado", hint: "Autorizados, esperando um responsável." },
  { key: "nao_autorizado", label: "Não autorizado", hint: "Negados. O solicitante pode reenviar com explicação." },
  { key: "reavaliacao", label: "Reavaliação", hint: "Pedidos não autorizados que o solicitante reenviou." },
  { key: "atribuido", label: "Atribuído", hint: "Com um responsável, que ainda não iniciou o atendimento." },
  { key: "andamento", label: "Em andamento", hint: "Um agente está trabalhando no pedido." },
  { key: "pausa", label: "Em pausa", hint: "Atendimento parado. Volta para Em andamento quando for retomado." },
  { key: "aguardando", label: "Aguardando solicitante", hint: "Esperando resposta do solicitante. Volta para Em andamento quando ele responder." },
  { key: "concluido", label: "Concluído", hint: "Entregues, esperando o solicitante aprovar ou pedir ajustes." },
  { key: "outros", label: "Outros estados", hint: "Estados que o Colabora ainda não reconhece. Peça ao administrador para mapeá-los." },
  { key: "finalizado", label: "Finalizado", hint: "Encerrados. Os 50 mais recentes dos seus setores." },
];

// As etapas, na ordem do fluxo, com a cor de cada uma (token do tema, via FLOW_BADGE). Finalizado não entra em
// "Em aberto": é o único encerrado.
export const STAGES: { key: StageBucket; label: string; hint: string; color: TicketStateColor; open: boolean }[] = [
  { key: "novo", label: "Novo", hint: "Esperam a sua análise.", color: "info", open: true },
  { key: "analise", label: "Em análise", hint: "Você está analisando.", color: "warning", open: true },
  { key: "autorizado", label: "Autorizado", hint: "Esperam um responsável.", color: "success", open: true },
  { key: "nao_autorizado", label: "Não autorizado", hint: "Esperam o solicitante reenviar.", color: "danger", open: true },
  { key: "reavaliacao", label: "Reavaliação", hint: "Reenviados: decida de novo.", color: "warning", open: true },
  { key: "atribuido", label: "Atribuído", hint: "Esperam o agente iniciar.", color: "info", open: true },
  { key: "andamento", label: "Em andamento", hint: "Com um agente trabalhando.", color: "primary", open: true },
  { key: "pausa", label: "Em pausa", hint: "Atendimento parado; volta quando for retomado.", color: "warning", open: true },
  { key: "aguardando", label: "Aguardando solicitante", hint: "Esperando resposta do solicitante.", color: "info", open: true },
  { key: "concluido", label: "Concluído", hint: "Esperam o retorno do solicitante.", color: "success", open: true },
  { key: "outros", label: "Outros estados", hint: "Estados que o Colabora não reconhece.", color: "neutral", open: true },
  { key: "finalizado", label: "Finalizado", hint: "Encerrados.", color: "neutral", open: false },
];

export const OPEN_STAGES = STAGES.filter((stage) => stage.open);

const BY_STEP: Record<FlowStepKey, StageBucket> = {
  novo: "novo",
  em_analise: "analise",
  autorizado: "autorizado",
  nao_autorizado: "nao_autorizado",
  reavaliacao: "reavaliacao",
  atribuido: "atribuido",
  em_andamento: "andamento",
  em_pausa: "pausa",
  aguardando_solicitante: "aguardando",
  concluido: "concluido",
  finalizado: "finalizado",
};

// `closed`: só importa fora do fluxo (estado genérico encerrado fica fora da fila).
export function bucketOf(step: FlowStepKey | null, hasOwner: boolean, closed = false, strict = false): StageBucket | null {
  if (step) return BY_STEP[step];
  if (closed) return null;
  // Zammad com os estados do fluxo da FEM: um estado desconhecido NÃO é agrupado em silêncio em Novo/Em andamento.
  if (strict) return "outros";
  return hasOwner ? "andamento" : "novo";
}

// Endereços antigos: ?etapa=atribuidos (aba que juntava os estados com agente) abre Em andamento.
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

// Contagem por etapa; "abertos" soma todas as etapas abertas (tudo menos Finalizado).
export function countBuckets<T extends { bucket: StageBucket }>(items: readonly T[]): Record<QueueBucket, number> {
  const counts = emptyCounts();
  for (const item of items) counts[item.bucket] += 1;
  counts.abertos = OPEN_STAGES.reduce((sum, stage) => sum + counts[stage.key], 0);
  return counts;
}

// O que pede ação do gestor agora (o número no menu "Fila").
export function pendingDecisions(counts: Record<QueueBucket, number>): number {
  return counts.novo + counts.analise + counts.reavaliacao + counts.autorizado;
}

// Os grupos da navegação da Fila: de quem é a vez. Cada etapa aparece em UM grupo (testado). "Outros estados" só
// aparece quando há chamado nele.
export const STAGE_GROUPS: { label: string; keys: StageBucket[] }[] = [
  { label: "Decisão do gestor", keys: ["novo", "analise", "autorizado", "reavaliacao"] },
  { label: "Com o agente", keys: ["atribuido", "andamento", "pausa"] },
  { label: "Esperando o solicitante", keys: ["aguardando", "nao_autorizado", "concluido"] },
  { label: "Outros", keys: ["outros"] },
  { label: "Encerrado", keys: ["finalizado"] },
];
