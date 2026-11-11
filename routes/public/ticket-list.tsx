import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { TicketSummary } from "../../index";
import { StateBadge, formatDateTime, toneBar } from "./shared";

// Lista de chamados, igual no portal e no app. Cada linha abre a conversa na MESMA superfície
// (`hrefFor`); o Zammad não aparece. `waiting` destaca o grupo que espera resposta de quem está olhando.
export function TicketGroup({
  title,
  tickets,
  hrefFor,
  waiting = false,
  muted = false,
  showRequester = false,
}: {
  title: string;
  tickets: TicketSummary[];
  hrefFor: (ticketId: number) => string;
  waiting?: boolean;
  muted?: boolean;
  showRequester?: boolean;
}) {
  if (tickets.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className={cn("flex items-center gap-2 text-sm font-semibold", waiting ? "text-warning" : "text-foreground", muted && "text-muted-foreground")}>
        {waiting && <BellRing className="size-4" />}
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{tickets.length}</span>
      </h2>
      <ul className="space-y-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={hrefFor(ticket.id)}
              className={cn(
                "group flex items-center gap-3 overflow-hidden rounded-xl border bg-card pe-3 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                waiting && "border-warning-border bg-warning-soft",
                muted && "opacity-80",
              )}
            >
              <span aria-hidden className={cn("w-1.5 self-stretch", waiting ? "bg-warning" : toneBar(ticket.stateTone))} />
              <span className="min-w-0 flex-1 space-y-1 py-3.5">
                <span className="block truncate font-medium text-foreground">{ticket.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  #{ticket.number} · {ticket.group}
                  {showRequester && ticket.requesterName ? ` · ${ticket.requesterName}` : ""} · {formatDateTime(ticket.updatedAt)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
                {showRequester && <span className="text-xs text-muted-foreground">{ticket.priorityLabel}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
