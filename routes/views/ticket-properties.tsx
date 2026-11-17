import { UserRound } from "lucide-react";
import type { TicketDetail } from "../../contracts/types";
import type { SurfaceKey } from "../../shared/routes";
import { CustomerDecisionPanel } from "../public/flow-actions";
import { FlowProgress } from "../public/flow-progress";
import { StateBadge, formatDateTime } from "../public/shared";
import { TagChips } from "../public/tag-chips";
import { TicketStateButton } from "../public/ticket-actions";
import { AllocationControls } from "./allocation-controls";
import { AttendanceControls } from "./attendance-controls";

// Propriedades do chamado (estado, etapas, pessoas, decisão do solicitante, alocação e atendimento). No portal
// em desktop vão para a BARRA CONTEXTUAL (ticket-sidebar.tsx); no celular e no app ficam empilhadas acima da
// conversa (ticket-view.tsx). `@container`: os controles se ajustam à largura de onde estão (coluna estreita
// da barra ou tela cheia), não à largura da janela.
export function TicketProperties({ ticket, surfaceKey, readOnly }: { ticket: TicketDetail; surfaceKey: SurfaceKey; readOnly: boolean }) {
  const agent = ticket.agent;
  return (
    <div className="@container space-y-4">
      <section aria-label="Dados do chamado" className="space-y-3 rounded-xl border border-t-4 border-t-primary bg-card p-4">
        {surfaceKey === "app" && <h2 className="text-lg leading-snug font-semibold break-words text-foreground">{ticket.title}</h2>}
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} color={ticket.stateColor} />
          {agent && <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">Prioridade: {ticket.priorityLabel}</span>}
          {agent && <TagChips tags={ticket.tags} className="contents" stateLabel={ticket.stateLabel} />}
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs @xs:grid-cols-2 @lg:grid-cols-3">
          {agent && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">Solicitante</dt>
              <dd className="flex items-center gap-1 truncate font-medium text-foreground">
                <UserRound className="size-3 shrink-0" />
                {ticket.requester.name}
              </dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-muted-foreground">Responsável</dt>
            <dd className="truncate font-medium text-foreground">{ticket.owner?.name ?? "Ninguém (na fila)"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Aberto em</dt>
            <dd className="font-medium text-foreground">{formatDateTime(ticket.createdAt)}</dd>
          </div>
        </dl>
        {ticket.flowStep && <FlowProgress step={ticket.flowStep} />}
        {/* Fora do fluxo da FEM: colaborador da equipe vendo o PRÓPRIO pedido encerra/reabre como antes. */}
        {!agent && !ticket.flowStep && ticket.canClose && <TicketStateButton ticketId={ticket.id} closed={ticket.closed} />}
      </section>

      {ticket.customerActions.length > 0 && (
        <CustomerDecisionPanel
          ticketId={ticket.id}
          title={ticket.flowStep === "nao_autorizado" ? "Seu pedido não foi autorizado" : "Seu pedido foi concluído. Está tudo certo?"}
          hint={
            ticket.flowStep === "nao_autorizado"
              ? "Veja o motivo na conversa. Se ajustou o pedido, reenvie explicando o que mudou."
              : "Confira a entrega e escolha uma opção. Sem resposta, o chamado é finalizado em 48 horas."
          }
          color={ticket.stateColor}
          actions={ticket.customerActions}
          readOnly={readOnly}
        />
      )}

      {agent && (
        <>
          <AllocationControls key={`alloc-${ticket.id}-${agent.ownerId}`} ticketId={ticket.id} controls={agent} />
          <AttendanceControls key={`att-${ticket.id}-${agent.stateId}-${agent.priorityId}`} ticketId={ticket.id} controls={agent} />
        </>
      )}
    </div>
  );
}
