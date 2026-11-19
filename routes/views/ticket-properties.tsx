import { Flag } from "lucide-react";
import type { TicketDetail } from "../../contracts/types";
import { isUrgentPriority } from "../../shared/agent-stats";
import type { SurfaceKey } from "../../shared/routes";
import { CustomerDecisionPanel } from "../public/flow-actions";
import { FlowProgress } from "../public/flow-progress";
import { StateBadge, formatDateTime } from "../public/shared";
import { TagChips } from "../public/tag-chips";
import { TicketStateButton } from "../public/ticket-actions";
import { AllocationControls } from "./allocation-controls";
import { AttendanceControls } from "./attendance-controls";
import { ChildTickets, ParentLink } from "./child-tickets";

// Propriedades do chamado. No portal em desktop vão para a BARRA CONTEXTUAL (ticket-sidebar.tsx); no celular e
// no app ficam acima da conversa (ticket-view.tsx). Regra de design: uma linha de status (estado, pessoas, data)
// + a barra de etapas, sem cartão; o único bloco é a decisão (solicitante) ou o "Próximo passo" (equipe).
// `@container`: os controles se ajustam à largura de onde estão (coluna estreita da barra ou tela cheia).
export function TicketProperties({ ticket, surfaceKey, readOnly }: { ticket: TicketDetail; surfaceKey: SurfaceKey; readOnly: boolean }) {
  const agent = ticket.agent;
  const urgent = agent && isUrgentPriority(ticket.priorityLabel);
  const people = agent
    ? [ticket.requester.name, ticket.owner ? `com ${ticket.owner.name}` : "na fila"]
    : [ticket.owner ? `Com ${ticket.owner.name}` : "Aguardando um responsável"];

  return (
    <div className="@container space-y-4">
      <section aria-label="Dados do chamado" className="space-y-3">
        {surfaceKey === "app" && <h2 className="text-lg leading-snug font-semibold break-words text-foreground">{ticket.title}</h2>}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
          <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} color={ticket.stateColor} />
          {urgent && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <Flag className="size-3.5" aria-hidden />
              {ticket.priorityLabel}
            </span>
          )}
          <span>
            {people.join(" · ")} · aberto em {formatDateTime(ticket.createdAt)}
            {/* Tempo previsto (definido pelo gestor): todos veem. */}
            {ticket.estimate?.label && (
              <>
                {" · "}
                <span className="text-foreground">tempo previsto: {ticket.estimate.label}</span>
              </>
            )}
          </span>
        </p>
        {ticket.flowStep && <FlowProgress step={ticket.flowStep} />}
        {ticket.parent && <ParentLink parent={ticket.parent} surfaceKey={surfaceKey} />}
        {agent && <TagChips tags={ticket.tags} stateLabel={ticket.stateLabel} />}
        {/* Fora do fluxo da FEM: colaborador da equipe vendo o PRÓPRIO pedido encerra/reabre como antes. */}
        {!agent && !ticket.flowStep && ticket.canClose && <TicketStateButton ticketId={ticket.id} closed={ticket.closed} />}
      </section>

      {ticket.customerActions.length > 0 && (
        <CustomerDecisionPanel
          ticketId={ticket.id}
          title={ticket.flowStep === "nao_autorizado" ? "Seu pedido não foi autorizado" : "Seu pedido foi concluído. Está tudo certo?"}
          hint={ticket.flowStep === "nao_autorizado" ? "Veja o motivo na conversa. Se ajustou o pedido, reenvie explicando o que mudou." : "Confira a entrega e nos diga."}
          note={ticket.flowStep === "nao_autorizado" ? undefined : "Sem resposta, finaliza em 48 h."}
          actions={ticket.customerActions}
          readOnly={readOnly}
        />
      )}

      {agent && (
        <AttendanceControls
          key={`att-${ticket.id}-${agent.stateId}-${agent.priorityId}-${agent.ownerId}-${ticket.estimate?.value ?? ""}`}
          ticketId={ticket.id}
          controls={agent}
          currentEstimate={ticket.estimate?.value ?? ""}
          allocation={agent.canAllocate ? <AllocationControls ticketId={ticket.id} controls={agent} /> : null}
        />
      )}

      {agent && !readOnly && <ChildTickets ticket={ticket} surfaceKey={surfaceKey} />}
    </div>
  );
}
