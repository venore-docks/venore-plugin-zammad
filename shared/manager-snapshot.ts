import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadExpandedTicket } from "../contracts/zammad";
import { UNASSIGNED_OWNER_ID } from "./access-rules";
import { teamFor } from "./directory";
import type { Requester } from "./requester";
import { SwrCache } from "./snapshot-cache";
import { searchOpenTicketsByOwner, searchTicketsByOwner } from "./ticket-search";
import { onZammadWrite } from "./zammad-client";

// A leitura mais cara do Colabora: os chamados da fila e de CADA agente da equipe do gestor (1 + N buscas no Zammad,
// todas com `expand`, ~0,3–0,8 s cada). Fila, Início do gestor, Equipe e a carga por agente usam a mesma leitura, e ela
// fica em memória (shared/snapshot-cache.ts): trocar de aba, setor ou ordem na Fila não volta ao Zammad.
//
//   - fresca por COLABORA_QUEUE_CACHE_SECONDS (padrão 20 s; 0 desliga);
//   - até 5 min depois, entrega o que tem na hora e atualiza em segundo plano;
//   - toda escrita do plugin no Zammad (atribuir, autorizar, responder…) descarta o cache;
//   - mudança feita direto no Zammad aparece em até esse tempo.
// Por gestor (os grupos que ele enxerga definem o que o Zammad devolve) e por modo (só abertos, ou com encerrados).

const MAX_MEMBERS = 40;
const STALE_MS = 5 * 60 * 1000;

export type ManagerSnapshotRaw = {
  members: { id: number; name: string }[];
  // Sem responsável, abertos e encerrados (quem usa separa).
  unassigned: ZammadExpandedTicket[];
  // Os de cada agente (mesma ordem de `members`): só abertos, ou também encerrados com `includeClosed`.
  perMember: ZammadExpandedTicket[][];
  // Todas as buscas responderam. Leitura incompleta não vai para o cache.
  complete: boolean;
};

function freshMs(): number {
  const raw = process.env.COLABORA_QUEUE_CACHE_SECONDS;
  if (raw === undefined || raw.trim() === "") return 20_000;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 20_000;
}

// Em `globalThis` porque o Next pode carregar o módulo mais de uma vez no mesmo processo (rotas e ações).
const holder = globalThis as typeof globalThis & { __colaboraManagerSnapshots?: SwrCache<ManagerSnapshotRaw>; __colaboraManagerSnapshotsWired?: boolean };
const cache = (holder.__colaboraManagerSnapshots ??= new SwrCache<ManagerSnapshotRaw>({
  freshMs: freshMs(),
  staleMs: STALE_MS,
  isCacheable: (value) => value.complete,
}));
if (!holder.__colaboraManagerSnapshotsWired) {
  holder.__colaboraManagerSnapshotsWired = true;
  onZammadWrite(() => cache.invalidate());
}

// Para os testes (e para um "recarregar" explícito, se um dia houver).
export function clearManagerSnapshots(): void {
  cache.invalidate();
}

async function fetchSnapshot(requester: Requester, includeClosed: boolean): Promise<OperationResult<ManagerSnapshotRaw>> {
  const team = await teamFor(requester);
  const members = team.members.slice(0, MAX_MEMBERS).map((member) => ({ id: member.id, name: member.name }));
  const byMember = includeClosed ? searchTicketsByOwner : searchOpenTicketsByOwner;
  const [unassigned, ...perMember] = await Promise.all([
    searchTicketsByOwner(requester, UNASSIGNED_OWNER_ID),
    ...members.map((member) => byMember(requester, member.id)),
  ]);
  if (!unassigned.success) return unassigned;
  return {
    success: true,
    data: {
      members,
      unassigned: unassigned.data,
      perMember: perMember.map((found) => (found.success ? found.data : [])),
      complete: perMember.every((found) => found.success),
    },
  };
}

export function loadManagerSnapshot(requester: Requester, options: { includeClosed?: boolean } = {}): Promise<OperationResult<ManagerSnapshotRaw>> {
  const includeClosed = Boolean(options.includeClosed);
  return cache.get(`${requester.zammadUser.id}:${includeClosed ? "all" : "open"}`, () => fetchSnapshot(requester, includeClosed));
}
