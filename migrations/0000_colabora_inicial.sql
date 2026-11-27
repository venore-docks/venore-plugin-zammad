CREATE SCHEMA "colabora";
--> statement-breakpoint
CREATE TABLE "colabora"."plugin_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"kind" text NOT NULL,
	"note" text NOT NULL,
	"related_ticket_id" integer,
	"related_number" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colabora"."ticket_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"ticket_id" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"state_id" integer,
	"state_name" text,
	"group_id" integer,
	"owner_id" integer,
	"motivo_pausa" text,
	"source" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colabora"."ticket_intervals" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"state_id" integer NOT NULL,
	"state_name" text NOT NULL,
	"group_id" integer,
	"agent_id" integer,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"motivo_pausa" text,
	"nota_plugin" text,
	"corrido_s" integer,
	"uteis_s" integer,
	"event_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "col_plugin_notes_ticket_idx" ON "colabora"."plugin_notes" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "col_ticket_events_event_uidx" ON "colabora"."ticket_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "col_ticket_events_ticket_idx" ON "colabora"."ticket_events" USING btree ("ticket_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "col_ticket_intervals_event_uidx" ON "colabora"."ticket_intervals" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "col_ticket_intervals_ticket_idx" ON "colabora"."ticket_intervals" USING btree ("ticket_id","started_at");--> statement-breakpoint
CREATE INDEX "col_ticket_intervals_agent_idx" ON "colabora"."ticket_intervals" USING btree ("agent_id","ended_at");