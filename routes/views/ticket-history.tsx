import { History } from "lucide-react";
import type { TicketDetail } from "../../contracts/types";
import { describeHistoryEntry } from "../../shared/ticket-history";
import { formatDateTime } from "../public/shared";

// Histórico do chamado na visão da equipe: abertura e cada mudança de estado, responsável, setor, prioridade e
// tempo previsto, com data, hora e quem mudou (fonte: histórico do Zammad). Recolhido por padrão (é consulta, não
// ação — regra de design: o secundário recolhido). A conversa continua sendo a linha do tempo das mensagens.
export function TicketHistory({ ticket }: { ticket: TicketDetail }) {
  const entries = ticket.history;
  if (!entries || entries.length === 0) return null;
  const changes = entries.filter((entry) => entry.kind !== "created").length;

  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <History className="size-4 text-muted-foreground" aria-hidden />
        Histórico
        <span className="text-xs font-normal text-muted-foreground">
          {changes === 1 ? "1 mudança" : `${changes} mudanças`}
        </span>
        <span aria-hidden className="ms-auto text-xs font-normal text-muted-foreground group-open:hidden">
          Ver
        </span>
        <span aria-hidden className="ms-auto hidden text-xs font-normal text-muted-foreground group-open:inline">
          Fechar
        </span>
      </summary>
      <ol className="space-y-2.5 border-t px-3 py-3">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="grid gap-0.5 text-sm">
            <span className="text-foreground">{describeHistoryEntry(entry)}</span>
            <span className="text-xs text-muted-foreground">
              <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
              {entry.byName && ` · por ${entry.byName}`}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
