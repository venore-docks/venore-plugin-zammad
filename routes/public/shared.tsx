import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import { Button } from "@venore/plugin-sdk/ui";
import type { TicketStateColor, TicketStateTone } from "../../contracts/types";
import { FLOW_BADGE } from "./palette";

// Cada estado tem uma cor SEMÂNTICA (tokens do tema, ver palette.ts): informação = novo, primária = em
// andamento, alerta = em análise/aguardando, sucesso = autorizado/concluído, perigo = não autorizado,
// neutro = finalizado. A bolinha reforça a cor sem depender só do texto. `tone` (legado) vira cor quando
// `color` não vem.
const TONE_COLOR: Record<TicketStateTone, TicketStateColor> = { new: "info", open: "primary", pending: "warning", closed: "neutral" };

function colorOf(tone: TicketStateTone, color?: TicketStateColor): TicketStateColor {
  return color ?? TONE_COLOR[tone];
}

export function toneBar(tone: TicketStateTone, color?: TicketStateColor): string {
  return FLOW_BADGE[colorOf(tone, color)].bar;
}

export function StateBadge({ label, tone, color }: { label: string; tone: TicketStateTone; color?: TicketStateColor }) {
  const classes = FLOW_BADGE[colorOf(tone, color)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-foreground", classes.badge)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", classes.dot)} />
      {label}
    </span>
  );
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

// Mensagem de bloqueio (sem permissão, conta inexistente no Zammad, integração desligada).
export function BlockedNotice({ title, message, showBack = false }: { title: string; message: string; showBack?: boolean }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-warning-border bg-warning-soft p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-foreground/80">{message}</p>
      {showBack && (
        <Button variant="outline" asChild>
          <Link href="/colabora">Voltar ao Colabora</Link>
        </Button>
      )}
    </div>
  );
}
