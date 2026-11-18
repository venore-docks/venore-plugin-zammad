import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { TicketSummary } from "../../index";
import { AwaitingBadge, LIST_CLASS, ROW_LINK_CLASS, StateBadge, formatDateTime } from "./shared";

// Lista de chamados, igual no portal e no app. Cada linha abre a conversa na MESMA superfície
// (`hrefFor`); o Zammad não aparece. Regra de design: um cartão com divisórias, título + setor · data, selo
// neutro; `waiting` (o grupo que espera quem está olhando) troca o selo pelo "Aguardando você".
export function TicketGroup({
  title,
  tickets,
  hrefFor,
  waiting = false,
  muted = false,
  showRequester = false,
  waitingLabel,
}: {
  title: string;
  tickets: TicketSummary[];
  hrefFor: (ticketId: number) => string;
  waiting?: boolean;
  muted?: boolean;
  showRequester?: boolean;
  /** Texto do selo de espera quando quem espera não é quem está olhando (ex.: gestor vendo um agente). */
  waitingLabel?: string;
}) {
  if (tickets.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className={cn("flex items-center gap-2 text-sm font-semibold", muted ? "text-muted-foreground" : "text-foreground")}>
        {title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{tickets.length}</span>
      </h2>
      <ul className={LIST_CLASS}>
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link href={hrefFor(ticket.id)} className={ROW_LINK_CLASS}>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className={cn("block truncate text-sm font-medium", muted ? "text-muted-foreground" : "text-foreground")}>{ticket.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {ticket.group}
                  {showRequester && ticket.requesterName ? ` · ${ticket.requesterName}` : ""} · {formatDateTime(ticket.updatedAt)}
                </span>
              </span>
              {waiting ? <AwaitingBadge label={waitingLabel} /> : <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} color={ticket.stateColor} />}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
