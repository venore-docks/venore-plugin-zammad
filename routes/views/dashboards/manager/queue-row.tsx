import Link from "next/link";
import { Flag } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { AssigneeOption, QueueRow as QueueRowData } from "../../../../features/get-manager-dashboard/types";
import { elapsedLabel, formatGroupName } from "../../../../shared/format";
import { ageTone } from "../../../../shared/manager-stats";
import type { FlowStepKey } from "../../../../contracts/types";
import { formatDateTime } from "../../../public/shared";
import { TagInline } from "../../../public/tag-chips";
import { DecisionActions } from "./decision-actions";
import { QuickAssign } from "./quick-assign";

// Idade do chamado: neutra até 1 dia, âmbar até 3, vermelha depois. O texto sempre diz o tempo (a cor só reforça).
export function AgeBadge({ ms }: { ms: number }) {
  const tone = ageTone(ms);
  return (
    <span
      className={cn("tabular-nums", tone === "aging" && "text-warning", tone === "stale" && "font-medium text-destructive")}
      title="Há quanto tempo o chamado foi aberto"
    >
      {elapsedLabel(ms)}
    </span>
  );
}

// Uma linha da fila (regra de design: um sinal por item). Título (bandeira se urgente) + setor · solicitante ·
// idade (· responsável), e UMA ação: "Analisar"/"Atribuir"/"Abrir" (fluxo da FEM) ou a alocação rápida (Zammad
// fora do fluxo). Número fica no detalhe; tags aparecem discretas na linha de metadados. Serve à home, à fila e ao app. Vai dentro de `LIST_CLASS`.
export function QueueRow({
  ticket,
  href,
  options,
  suggestedId,
  flowStateIds = {},
}: {
  ticket: QueueRowData;
  href: string;
  options: AssigneeOption[];
  suggestedId: number | null;
  flowStateIds?: Partial<Record<FlowStepKey, number>>;
}) {
  // Estado desconhecido (balde "outros") também não oferece alocação: só "Abrir".
  const inFlow = (ticket.step !== null || ticket.bucket === "outros") && Object.keys(flowStateIds).length > 0;
  const meta = [formatGroupName(ticket.group), ticket.requesterName].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          href={href}
          className="flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          title={ticket.title}
        >
          {ticket.urgent && <Flag className="size-3.5 shrink-0 text-destructive" aria-label={`Prioridade ${ticket.priorityLabel}`} />}
          <span className="truncate">{ticket.title}</span>
        </Link>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {meta && <span className="truncate">{meta}</span>}
          {meta && <span aria-hidden>·</span>}
          <AgeBadge ms={ticket.ageMs} />
          {ticket.ownerId !== null && <span>· com {ticket.ownerName ?? "um agente"}</span>}
          {/* Tem responsável mas ainda espera a análise: atribuído por fora do fluxo. Sinaliza a inconsistência. */}
          {ticket.ownerId !== null && (ticket.bucket === "novo" || ticket.bucket === "analise" || ticket.bucket === "reavaliacao") && (
            <span
              title="Este chamado já tem responsável, mas ainda não foi analisado. Foi atribuído fora do fluxo do Colabora."
              className="rounded-full border border-warning-border bg-warning-soft px-1.5 py-px text-[0.6875rem] text-foreground"
            >
              atribuído sem iniciar
            </span>
          )}
          {ticket.deadline && <span title="Prazo de entrega">· prazo {formatDateTime(ticket.deadline)}</span>}
          {ticket.estimateLabel && <span title="Tempo previsto">· {ticket.estimateLabel}</span>}
          {ticket.tags.length > 0 && <span aria-hidden>·</span>}
          <TagInline tags={ticket.tags} stateLabel={ticket.stateLabel} />
        </p>
      </div>
      <div className="md:shrink-0">
        {inFlow ? (
          <DecisionActions
            ticketId={ticket.id}
            title={ticket.title}
            bucket={ticket.bucket}
            detailHref={href}
            flowStateIds={flowStateIds}
            options={options}
            suggestedId={suggestedId}
          />
        ) : (
          <QuickAssign ticketId={ticket.id} options={options} suggestedId={suggestedId} />
        )}
      </div>
    </li>
  );
}
