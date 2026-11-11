import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import { Button } from "@venore/plugin-sdk/ui";
import type { TicketStateTone } from "../../contracts/types";

// Cada estado tem uma cor própria (tokens do tema): novo = azul-esverdeado, em atendimento = cor
// primária, aguardando = âmbar, encerrado = neutro. A bolinha reforça a cor sem depender só do texto.
const TONES: Record<TicketStateTone, { badge: string; dot: string; bar: string }> = {
  new: { badge: "border-chart-2/40 bg-chart-2/10", dot: "bg-chart-2", bar: "bg-chart-2" },
  open: { badge: "border-primary/40 bg-primary/10", dot: "bg-primary", bar: "bg-primary" },
  pending: { badge: "border-warning-border bg-warning-soft", dot: "bg-warning", bar: "bg-warning" },
  closed: { badge: "border-border bg-muted", dot: "bg-muted-foreground/50", bar: "bg-border" },
};

export function toneBar(tone: TicketStateTone): string {
  return TONES[tone].bar;
}

export function StateBadge({ label, tone }: { label: string; tone: TicketStateTone }) {
  const classes = TONES[tone];
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
          <Link href="/chamados">Voltar para meus chamados</Link>
        </Button>
      )}
    </div>
  );
}
