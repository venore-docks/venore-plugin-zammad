import type { TicketHistoryEntry, TicketHistoryKind } from "../contracts/types";
import { describeState } from "./ticket-state";

// Histórico do chamado (v1.9.0): quando o chamado foi aberto e cada mudança de estado, responsável, setor,
// prioridade e tempo previsto, com data, hora e quem mudou. A fonte é o próprio Zammad
// (`GET /ticket_history/:id`, que exige papel de agente), então o Colabora não guarda nada à parte.
// Puro: testado em ticket-history.test.ts.
//
// Formato do Zammad (um item por mudança; artigos, notificações e e-mails também aparecem e ficam de fora):
//   { history: [{ history_type: "created" | "updated" | …, history_object: "Ticket" | "Ticket::Article" | …,
//                 history_attribute: "state" | "owner" | "group" | "priority" | <campo> | null,
//                 value_from, value_to, created_by_id, created_at }],
//     assets: { User: { "<id>": { firstname, lastname } } } }

export type RawHistoryItem = {
  history_type?: string | null;
  history_object?: string | null;
  history_attribute?: string | null;
  value_from?: string | null;
  value_to?: string | null;
  created_by_id?: number | null;
  created_at?: string | null;
};

export type RawHistory = {
  history?: RawHistoryItem[] | null;
  assets?: { User?: Record<string, { firstname?: string | null; lastname?: string | null } | undefined> } | null;
};

export type HistoryOptions = {
  // Campo do tempo previsto no Zammad e os rótulos das opções (valor → rótulo).
  estimateField?: string;
  estimateLabels?: Record<string, string>;
};

// Zammad usa o usuário 1 para o próprio sistema (gatilhos, agendador) e "- -" como nome do responsável vazio.
const SYSTEM_USER_ID = 1;
const EMPTY_OWNER = /^[-\s]*$/;

const ATTRIBUTE_KIND: Record<string, TicketHistoryKind> = { state: "state", owner: "owner", group: "group", priority: "priority" };

function kindOf(item: RawHistoryItem, options: HistoryOptions): TicketHistoryKind | null {
  if (item.history_object !== "Ticket") return null;
  if (item.history_type === "created") return "created";
  if (item.history_type !== "updated" || !item.history_attribute) return null;
  if (options.estimateField && item.history_attribute === options.estimateField) return "estimate";
  return ATTRIBUTE_KIND[item.history_attribute] ?? null;
}

function display(kind: TicketHistoryKind, value: string | null | undefined, options: HistoryOptions): string | null {
  const text = (value ?? "").trim();
  switch (kind) {
    case "state":
      return text ? describeState(text).label : null;
    case "owner":
      return text && !EMPTY_OWNER.test(text) ? text : null;
    case "group":
      return text ? text.split("::").map((part) => part.trim()).join(" › ") : null;
    case "estimate":
      return text ? (options.estimateLabels?.[text] ?? text) : null;
    default:
      return text || null;
  }
}

function actorName(raw: RawHistory, id: number | null | undefined): string | null {
  if (!id) return null;
  if (id === SYSTEM_USER_ID) return "Sistema";
  const user = raw.assets?.User?.[String(id)];
  const name = [user?.firstname, user?.lastname].filter((part) => part && part.trim()).join(" ").trim();
  return name || null;
}

export function toTicketHistory(raw: RawHistory, options: HistoryOptions = {}): TicketHistoryEntry[] {
  const entries: TicketHistoryEntry[] = [];
  for (const item of raw.history ?? []) {
    const kind = kindOf(item, options);
    if (!kind || !item.created_at) continue;
    const from = kind === "created" ? null : display(kind, item.value_from, options);
    const to = kind === "created" ? null : display(kind, item.value_to, options);
    // Mudança que não muda nada visível (ex.: "new" → "Novo", mesmo rótulo) não é histórico.
    if (kind !== "created" && from === to) continue;
    entries.push({ at: item.created_at, kind, from, to, byName: actorName(raw, item.created_by_id) });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

// Texto de uma linha do histórico ("Estado: Novo → Em análise").
const KIND_LABEL: Record<TicketHistoryKind, string> = {
  created: "Chamado aberto",
  state: "Estado",
  owner: "Responsável",
  group: "Setor",
  priority: "Prioridade",
  estimate: "Tempo previsto",
};

export function describeHistoryEntry(entry: TicketHistoryEntry): string {
  if (entry.kind === "created") return KIND_LABEL.created;
  const from = entry.from ?? (entry.kind === "owner" ? "sem responsável" : "—");
  const to = entry.to ?? (entry.kind === "owner" ? "sem responsável" : "—");
  return `${KIND_LABEL[entry.kind]}: ${from} → ${to}`;
}
