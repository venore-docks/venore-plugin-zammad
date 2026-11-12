import Link from "next/link";
import { Clock, Flag } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { AssigneeOption, QueueRow as QueueRowData } from "../../../../features/get-manager-dashboard/types";
import { ageTone, formatAge, shortGroupName } from "../../../../shared/manager-stats";
import { QuickAssign } from "./quick-assign";

// Idade do chamado: neutra até 1 dia, âmbar até 3, vermelha depois. O texto sempre diz o tempo (a cor só reforça).
export function AgeBadge({ ms }: { ms: number }) {
  const tone = ageTone(ms);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        tone === "fresh" && "text-muted-foreground",
        tone === "aging" && "text-warning",
        tone === "stale" && "text-destructive",
      )}
      title="Há quanto tempo o chamado foi aberto"
    >
      <Clock className="size-3" aria-hidden />
      {formatAge(ms)}
    </span>
  );
}

// Uma linha da fila: o chamado (abre o detalhe) e, embaixo, a alocação rápida. Serve à home, à fila e ao app.
export function QueueRow({
  ticket,
  href,
  options,
  suggestedId,
}: {
  ticket: QueueRowData;
  href: string;
  options: AssigneeOption[];
  suggestedId: number | null;
}) {
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0 flex-1 space-y-1 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span className="block truncate font-medium text-foreground">{ticket.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            #{ticket.number} · {shortGroupName(ticket.group)}
            {ticket.requesterName ? ` · ${ticket.requesterName}` : ""}
          </span>
        </Link>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <AgeBadge ms={ticket.ageMs} />
          {ticket.urgent && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-foreground">
              <Flag className="size-3 text-destructive" aria-hidden />
              {ticket.priorityLabel}
            </span>
          )}
        </span>
      </div>
      <QuickAssign ticketId={ticket.id} options={options} suggestedId={suggestedId} />
    </li>
  );
}
