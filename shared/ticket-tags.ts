import "server-only";
import type { Requester } from "./requester";
import { zammadRequest } from "./zammad-client";

// Tags dos chamados. A busca do Zammad (`tickets/search`) não traz as tags, então lemos uma a uma
// (`GET /tags?object=Ticket&o_id=<id>`), em nome de quem pede, com poucas em paralelo e cache curto.
// Falha numa leitura = sem tags naquele card (nunca derruba a lista).
const CONCURRENCY = 8;
const TTL_MS = 60 * 1000;

const cache = new Map<string, { at: number; tags: string[] }>();

function cacheKey(ticket: { id: number; updated_at?: string | null }): string {
  return `${ticket.id}:${ticket.updated_at ?? ""}`;
}

async function readTags(requester: Requester, ticketId: number): Promise<string[]> {
  const result = await zammadRequest<{ tags?: unknown }>(`tags?object=Ticket&o_id=${ticketId}`, { onBehalfOf: requester.email, timeoutMs: 10000 });
  if (!result.success || !Array.isArray(result.data?.tags)) return [];
  return result.data.tags.filter((tag): tag is string => typeof tag === "string");
}

export async function loadTicketTags(requester: Requester, tickets: readonly { id: number; updated_at?: string | null }[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const pending: { id: number; key: string }[] = [];
  const now = Date.now();
  for (const ticket of tickets) {
    const key = cacheKey(ticket);
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) out.set(ticket.id, hit.tags);
    else pending.push({ id: ticket.id, key });
  }

  let next = 0;
  async function worker(): Promise<void> {
    while (next < pending.length) {
      const item = pending[next++];
      const tags = await readTags(requester, item.id);
      cache.set(item.key, { at: Date.now(), tags });
      out.set(item.id, tags);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

  if (cache.size > 2000) {
    for (const [key, value] of cache) if (Date.now() - value.at >= TTL_MS) cache.delete(key);
  }
  return out;
}
