import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { TicketSummary } from "../../../../contracts/types";
import { isStale, isUrgentPriority, waitingLabel } from "../../../../shared/agent-stats";
import { StateBadge } from "../../../public/shared";

// Linha de chamado do agente: confortável ao toque (altura mínima), título sempre truncado, quem espera e há quanto
// tempo. Usada no dashboard e em "Atribuídos a mim" (o `TicketGroup` compartilhado não tem essas informações).
export function AgentTicketRow({ ticket, href, now }: { ticket: TicketSummary; href: string; now: Date }) {
  const urgent = isUrgentPriority(ticket.priorityLabel);
  const stale = isStale(ticket, now);
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group flex min-h-16 items-center gap-3 overflow-hidden rounded-xl border bg-card pe-3 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          ticket.awaitingYou && "border-warning-border",
        )}
      >
        <span aria-hidden className={cn("w-1.5 self-stretch", urgent ? "bg-destructive" : ticket.awaitingYou ? "bg-warning" : "bg-border")} />
        <span className="min-w-0 flex-1 space-y-1 py-3">
          <span className="block truncate text-sm font-medium text-foreground sm:text-base">{ticket.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            #{ticket.number}
            {ticket.requesterName ? ` · ${ticket.requesterName}` : ""} · {ticket.group}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="sm:hidden">
              <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
            </span>
            {urgent && <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-foreground">{ticket.priorityLabel}</span>}
            <span className={cn("inline-flex items-center gap-1 text-xs", stale ? "font-medium text-warning" : "text-muted-foreground")}>
              <Clock className="size-3" aria-hidden />
              {ticket.awaitingYou ? `Esperando ${waitingLabel(ticket.updatedAt, now)}` : `Atualizado ${waitingLabel(ticket.updatedAt, now)}`}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 sm:block">
          <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}

export function AgentTicketList({ tickets, hrefFor, now, label }: { tickets: TicketSummary[]; hrefFor: (ticketId: number) => string; now: Date; label: string }) {
  return (
    <ul className="space-y-2" aria-label={label}>
      {tickets.map((ticket) => (
        <AgentTicketRow key={ticket.id} ticket={ticket} href={hrefFor(ticket.id)} now={now} />
      ))}
    </ul>
  );
}
