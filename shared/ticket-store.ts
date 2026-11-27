import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { colPluginNotes, colTicketEvents, colTicketIntervals } from "../database/schema";

// Acesso ao banco do Colabora (schema `colabora`). Regras:
//   - eventos: gravação IDEMPOTENTE pela chave natural (`event_id` único). Repetido não duplica; a contagem devolvida
//     é só dos novos;
//   - intervalos: são DERIVADOS dos eventos. `replaceTicketIntervals` troca todos os de um chamado numa transação
//     (recalcular de novo dá o mesmo resultado; evento fora de ordem só muda o recálculo seguinte);
//   - notas do plugin: anotações que não vão para o Zammad (ex.: "interrompido por #N").
// Testado contra Postgres em memória (PGlite) em tests/integration.

export type TicketEventInput = {
  eventId: string;
  ticketId: number;
  occurredAt: Date;
  stateId?: number | null;
  stateName?: string | null;
  groupId?: number | null;
  ownerId?: number | null;
  motivoPausa?: string | null;
  source: "history" | "webhook" | "plugin";
};

export type TicketEventRow = typeof colTicketEvents.$inferSelect;
export type TicketIntervalInput = Omit<typeof colTicketIntervals.$inferInsert, "id">;
export type TicketIntervalRow = typeof colTicketIntervals.$inferSelect;
export type PluginNoteRow = typeof colPluginNotes.$inferSelect;

export async function saveTicketEvents(events: readonly TicketEventInput[]): Promise<number> {
  if (events.length === 0) return 0;
  const inserted = await db
    .insert(colTicketEvents)
    .values(
      events.map((event) => ({
        eventId: event.eventId,
        ticketId: event.ticketId,
        occurredAt: event.occurredAt,
        stateId: event.stateId ?? null,
        stateName: event.stateName ?? null,
        groupId: event.groupId ?? null,
        ownerId: event.ownerId ?? null,
        motivoPausa: event.motivoPausa ?? null,
        source: event.source,
      })),
    )
    .onConflictDoNothing({ target: colTicketEvents.eventId })
    .returning({ id: colTicketEvents.id });
  return inserted.length;
}

// Eventos de um chamado em ordem cronológica (empate: pela chave, para o resultado ser estável).
export async function listTicketEvents(ticketId: number): Promise<TicketEventRow[]> {
  return db.select().from(colTicketEvents).where(eq(colTicketEvents.ticketId, ticketId)).orderBy(asc(colTicketEvents.occurredAt), asc(colTicketEvents.eventId));
}

export async function replaceTicketIntervals(ticketId: number, intervals: readonly TicketIntervalInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(colTicketIntervals).where(eq(colTicketIntervals.ticketId, ticketId));
    if (intervals.length > 0) await tx.insert(colTicketIntervals).values(intervals.map((interval) => ({ ...interval, ticketId })));
  });
}

export async function listTicketIntervals(ticketIds: readonly number[]): Promise<TicketIntervalRow[]> {
  if (ticketIds.length === 0) return [];
  return db
    .select()
    .from(colTicketIntervals)
    .where(inArray(colTicketIntervals.ticketId, [...ticketIds]))
    .orderBy(asc(colTicketIntervals.ticketId), asc(colTicketIntervals.startedAt));
}

export type PluginNoteInput = {
  ticketId: number;
  kind: "interrupted";
  note: string;
  relatedTicketId?: number | null;
  relatedNumber?: string | null;
  actorId?: string | null;
};

export async function addPluginNote(note: PluginNoteInput): Promise<void> {
  await db.insert(colPluginNotes).values({
    ticketId: note.ticketId,
    kind: note.kind,
    note: note.note,
    relatedTicketId: note.relatedTicketId ?? null,
    relatedNumber: note.relatedNumber ?? null,
    actorId: note.actorId ?? null,
  });
}

// As mais recentes primeiro.
export async function listPluginNotes(ticketId: number, limit = 20): Promise<PluginNoteRow[]> {
  return db.select().from(colPluginNotes).where(eq(colPluginNotes.ticketId, ticketId)).orderBy(desc(colPluginNotes.createdAt)).limit(limit);
}

// Texto da anotação de pausa automática.
export function interruptedNote(byNumber: string): string {
  return `Interrompido por #${byNumber}`;
}
