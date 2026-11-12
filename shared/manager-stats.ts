// Estatísticas da superfície do gestor (fila, equipe, carga). Puro (sem Zammad): testado em manager-stats.test.ts.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Prioridade "urgente": o Zammad padrão tem "3 high"; a FEM também usa "4 urgente"/"alta". O nome é normalizado.
export function isUrgentPriority(name: string | null | undefined): boolean {
  const text = (name ?? "").toLowerCase();
  return /urgen|high|alta|critic/.test(text);
}

export function ageMs(iso: string, now: number): number {
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? 0 : Math.max(0, now - at);
}

// "agora", "5 h", "3 d" — curto para caber em linha de lista.
export function formatAge(ms: number): string {
  if (ms < HOUR_MS) return "menos de 1 h";
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)} h`;
  return `${Math.floor(ms / DAY_MS)} d`;
}

export type AgeTone = "fresh" | "aging" | "stale";

// Fila parada há mais de 1 dia pede atenção; mais de 3 dias, urgência.
export function ageTone(ms: number): AgeTone {
  if (ms >= 3 * DAY_MS) return "stale";
  if (ms >= DAY_MS) return "aging";
  return "fresh";
}

export type LoadInput = { id: number; name: string; open: number; waiting: number };
export type LoadLevel = "idle" | "normal" | "heavy";

const HEAVY_MIN_OPEN = 6;
const HEAVY_FACTOR = 1.5;

// Sobrecarregado: muitos abertos em absoluto E bem acima da média da equipe. Livre: nada em aberto (só vale
// numa equipe de 2 ou mais, senão "livre" não compara com ninguém).
export function loadLevel(open: number, loads: { open: number }[]): LoadLevel {
  if (loads.length < 2) return "normal";
  const average = loads.reduce((sum, load) => sum + load.open, 0) / loads.length;
  if (open >= HEAVY_MIN_OPEN && open >= average * HEAVY_FACTOR) return "heavy";
  if (open === 0) return "idle";
  return "normal";
}

export type AgentLoadRow = LoadInput & { level: LoadLevel };

// Mais carregados primeiro (abertos, depois aguardando, depois nome).
export function rankLoads(loads: LoadInput[]): AgentLoadRow[] {
  return [...loads]
    .sort((a, b) => b.open - a.open || b.waiting - a.waiting || a.name.localeCompare(b.name, "pt-BR"))
    .map((load) => ({ ...load, level: loadLevel(load.open, loads) }));
}

// Maior carga da equipe (para escalar as barras; nunca 0, para não dividir por zero).
export function maxOpen(loads: { open: number }[]): number {
  return Math.max(1, ...loads.map((load) => load.open));
}

// Largura (0–100) de um valor em relação ao maior.
export function percentOf(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

// O agente menos carregado entre os candidatos (menos abertos; empate: menos aguardando, depois a ordem dada).
export function pickLeastLoaded<T extends { id: number; open: number; waiting?: number }>(candidates: T[]): T | null {
  let best: T | null = null;
  for (const candidate of candidates) {
    if (!best || candidate.open < best.open || (candidate.open === best.open && (candidate.waiting ?? 0) < (best.waiting ?? 0))) best = candidate;
  }
  return best;
}

export type KpiTicket = { ownerId: number | null; priority: string; customerWaiting: boolean; createdAt: string };

export type ManagerKpis = {
  queue: number;
  // Idade do chamado mais antigo da fila (null = fila vazia).
  queueOldestMs: number | null;
  // Abertos já atribuídos a alguém da equipe.
  inService: number;
  // O solicitante falou por último: espera resposta do atendimento.
  awaitingSupport: number;
  // Urgentes (fila + em atendimento).
  urgent: number;
};

export function summarizeManager(queue: KpiTicket[], assigned: KpiTicket[], now: number): ManagerKpis {
  const oldest = queue.length === 0 ? null : Math.max(...queue.map((ticket) => ageMs(ticket.createdAt, now)));
  return {
    queue: queue.length,
    queueOldestMs: oldest,
    inService: assigned.length,
    awaitingSupport: assigned.filter((ticket) => ticket.customerWaiting).length,
    urgent: [...queue, ...assigned].filter((ticket) => isUrgentPriority(ticket.priority)).length,
  };
}

export type QueueSort = "idade" | "prioridade";

export function parseQueueSort(value: string | undefined): QueueSort {
  return value === "prioridade" ? "prioridade" : "idade";
}

export type SortableQueueItem = { id: number; ageMs: number; priorityId: number };

// idade: o mais antigo primeiro. prioridade: maior prioridade primeiro (id maior = mais urgente no Zammad), e
// dentro dela o mais antigo.
export function sortQueue<T extends SortableQueueItem>(items: T[], by: QueueSort): T[] {
  return [...items].sort((a, b) => (by === "prioridade" ? b.priorityId - a.priorityId || b.ageMs - a.ageMs : b.ageMs - a.ageMs) || a.id - b.id);
}

// ?setor=<id do grupo>: número válido ou undefined.
export function parseSectorFilter(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id > 0 ? id : undefined;
}

export type SectorChip = { id: number; name: string; count: number };

// Chips de setor a partir de uma lista de itens (um por chamado), do mais cheio ao menos; nome do primeiro visto.
export function sectorChips(items: { groupId: number; group: string }[]): SectorChip[] {
  const byId = new Map<number, SectorChip>();
  for (const item of items) {
    const chip = byId.get(item.groupId);
    if (chip) chip.count += 1;
    else byId.set(item.groupId, { id: item.groupId, name: item.group, count: 1 });
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

// Nome curto do setor: o Zammad guarda "Pai::Filho"; mostramos o último trecho.
export function shortGroupName(name: string): string {
  const parts = name.split("::");
  return (parts[parts.length - 1] ?? name).trim() || name;
}

// Monta o link de uma tela com os parâmetros presentes (omite vazios).
export function hrefWith(base: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `${base}?${text}` : base;
}
