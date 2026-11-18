import Link from "next/link";
import { ChevronRight, Flag } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { TicketSummary } from "../../../../contracts/types";
import { isStale, isUrgentPriority, waitingLabel } from "../../../../shared/agent-stats";
import { LIST_CLASS, ROW_LINK_CLASS, StateBadge } from "../../../public/shared";

// Linha de chamado do agente (regra de design: um sinal por item). Título (com bandeira se urgente) e
// solicitante · setor · tempo; o tempo só ganha cor quando passou do prazo de retorno. Tags e número ficam no
// detalhe. Usada no dashboard e em "Atribuídos a mim".
export function AgentTicketRow({ ticket, href, now }: { ticket: TicketSummary; href: string; now: Date }) {
  const urgent = isUrgentPriority(ticket.priorityLabel);
  const stale = isStale(ticket, now);
  return (
    <li>
      <Link href={href} className={ROW_LINK_CLASS}>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {urgent && <Flag className="size-3.5 shrink-0 text-destructive" aria-label={`Prioridade ${ticket.priorityLabel}`} />}
            <span className="truncate">{ticket.title}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {ticket.requesterName ? `${ticket.requesterName} · ` : ""}
            {ticket.group} ·{" "}
            <span className={cn(stale && "font-medium text-warning")}>
              {ticket.awaitingYou ? `esperando ${waitingLabel(ticket.updatedAt, now)}` : `atualizado ${waitingLabel(ticket.updatedAt, now)}`}
            </span>
          </span>
        </span>
        <span className="hidden sm:block">
          <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} color={ticket.stateColor} />
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}

export function AgentTicketList({ tickets, hrefFor, now, label }: { tickets: TicketSummary[]; hrefFor: (ticketId: number) => string; now: Date; label: string }) {
  return (
    <ul className={LIST_CLASS} aria-label={label}>
      {tickets.map((ticket) => (
        <AgentTicketRow key={ticket.id} ticket={ticket} href={hrefFor(ticket.id)} now={now} />
      ))}
    </ul>
  );
}
