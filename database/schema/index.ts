import { index, integer, pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Banco do Colabora (schema Postgres `colabora`, v1.13.0). O Zammad continua a fonte da verdade do ESTADO ATUAL de
// cada chamado; aqui fica o que o Zammad não guarda do jeito que o plugin precisa: os eventos de estado (para medir
// tempo por etapa), os intervalos já calculados e as anotações que são só do plugin. Nada de dados pessoais: ids
// do Zammad (chamado, estado, grupo, agente) e o id da conta do portal de quem agiu.
// Um plugin nunca referencia o schema de outro: ids de usuário são texto solto, sem FK.

export const colaboraSchema = pgSchema("colabora");

// Evento de um chamado vindo do Zammad: uma entrada do histórico (`ticket_history`) ou um aviso do webhook.
// `event_id` é a chave natural ("history:<id>", "webhook:<id>"…) e é ÚNICO: o mesmo evento recebido de novo (webhook
// repetido, conferência que relê o histórico) não duplica. Fora de ordem não importa: os intervalos são recalculados
// a partir de todos os eventos do chamado, pela data.
export const colTicketEvents = colaboraSchema.table(
  "ticket_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id").notNull(),
    ticketId: integer("ticket_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    // Retrato do chamado logo depois do evento (o que se souber; null = não informado pelo evento).
    stateId: integer("state_id"),
    stateName: text("state_name"),
    groupId: integer("group_id"),
    ownerId: integer("owner_id"),
    motivoPausa: text("motivo_pausa"),
    // "history" | "webhook" | "plugin"
    source: text("source").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("col_ticket_events_event_uidx").on(table.eventId), index("col_ticket_events_ticket_idx").on(table.ticketId, table.occurredAt)],
);

// Tempo que o chamado passou num estado: começa num evento (`event_id`, único) e termina no evento seguinte
// (`ended_at` null = é o estado atual). `corrido_s` = tempo de relógio; `uteis_s` = só o expediente do calendário do
// Zammad. `motivo_pausa` é o retrato do motivo naquele intervalo (o Zammad esvazia o campo ao retomar).
// `nota_plugin` = anotação do plugin que vale para o intervalo (ex.: "interrompido por #1234").
export const colTicketIntervals = colaboraSchema.table(
  "ticket_intervals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: integer("ticket_id").notNull(),
    stateId: integer("state_id").notNull(),
    stateName: text("state_name").notNull(),
    groupId: integer("group_id"),
    agentId: integer("agent_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    motivoPausa: text("motivo_pausa"),
    notaPlugin: text("nota_plugin"),
    corridoS: integer("corrido_s"),
    uteisS: integer("uteis_s"),
    eventId: text("event_id").notNull(),
  },
  (table) => [
    uniqueIndex("col_ticket_intervals_event_uidx").on(table.eventId),
    index("col_ticket_intervals_ticket_idx").on(table.ticketId, table.startedAt),
    index("col_ticket_intervals_agent_idx").on(table.agentId, table.endedAt),
  ],
);

// Anotação só do plugin (não vai para o Zammad). `kind`: "interrupted" = pausado automaticamente porque o responsável
// iniciou outro chamado (`related_ticket_id`/`related_number`). `actor_id` = conta do portal de quem agiu.
export const colPluginNotes = colaboraSchema.table(
  "plugin_notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: integer("ticket_id").notNull(),
    kind: text("kind").notNull(),
    note: text("note").notNull(),
    relatedTicketId: integer("related_ticket_id"),
    relatedNumber: text("related_number"),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("col_plugin_notes_ticket_idx").on(table.ticketId, table.createdAt)],
);
