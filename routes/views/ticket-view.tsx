import { BellRing, CircleCheck, UserRound } from "lucide-react";
import { getTicket } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { Conversation } from "../public/conversation";
import { ReplyProvider } from "../public/reply-context";
import { BlockedNotice, StateBadge, formatDateTime } from "../public/shared";
import { ReplyBox, TicketStateButton } from "../public/ticket-actions";
import { AllocationControls } from "./allocation-controls";
import { AttendanceControls } from "./attendance-controls";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";

// A conversa de um chamado, nas duas superfícies. Solicitante: vê as mensagens e responde. Agente (chamado
// atribuído a ele): vê também as notas internas e o solicitante, e atende (responde, nota, estado, prioridade).
// Gestor/admin: vê chamados da equipe e da fila e ALOCA (atribui/realoca/devolve à fila).
// (Dono dos controles: allocation-controls.tsx = gestor; attendance-controls.tsx = agente.)
export async function TicketView({ surfaceKey, ticketId }: { surfaceKey: SurfaceKey; ticketId: number }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.detail(ticketId));
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active={null} title="Chamado" backHref={surface.mine}>
        <BlockedNotice title="Chamado" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;

  const result = await getTicket({ ticketId, asAgent: true });
  if (!result.success) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active={null} title="Chamado" backHref={surface.mine}>
        <BlockedNotice title="Chamado" message={result.error.message} />
      </ColaboraFrame>
    );
  }
  const ticket = result.data;
  const agent = ticket.agent;
  const backHref = agent ? (ticket.owner === null ? surface.queue : surface.assigned) : surface.mine;

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active={null}
      title={surfaceKey === "app" ? `#${ticket.number}` : ticket.title}
      subtitle={surfaceKey === "app" ? ticket.group : `#${ticket.number} · ${ticket.group} · aberto em ${formatDateTime(ticket.createdAt)}`}
      backHref={backHref}
    >
      <ReplyProvider>
        <div className="mx-auto max-w-3xl space-y-4 pb-6">
          <header className="space-y-3 rounded-xl border border-t-4 border-t-primary bg-card p-4 sm:p-5">
            {surfaceKey === "app" && <h2 className="text-lg leading-snug font-semibold break-words text-foreground">{ticket.title}</h2>}
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
              {agent && <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">Prioridade: {ticket.priorityLabel}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
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
            {/* Colaborador da equipe vendo o PRÓPRIO pedido: encerrar/reabrir como antes. */}
            {!agent && ticket.canClose && <TicketStateButton ticketId={ticket.id} closed={ticket.closed} />}
          </header>

          {agent && (
            <>
              <AllocationControls key={`alloc-${ticket.id}-${agent.ownerId}`} ticketId={ticket.id} controls={agent} />
              <AttendanceControls key={`att-${ticket.id}-${agent.stateId}-${agent.priorityId}`} ticketId={ticket.id} controls={agent} />
            </>
          )}

          {agent && ticket.customerWaiting && (
            <div className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-foreground">
              <BellRing className="size-5 shrink-0 text-warning" />
              <span>
                <strong>O solicitante respondeu.</strong> Veja a última mensagem e responda.
              </span>
            </div>
          )}
          {!agent && ticket.awaitingYou && (
            <a href="#responder" className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-foreground">
              <BellRing className="size-5 shrink-0 text-warning" />
              <span>
                <strong>A equipe respondeu.</strong> Veja a mensagem abaixo e responda se precisar.
              </span>
            </a>
          )}
          {ticket.closed && (
            <div className="flex items-start gap-3 rounded-xl border border-success-border bg-success-soft p-3 text-sm text-foreground">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
              <span>
                <strong>Este chamado está encerrado.</strong>
                {agent ? " Para reabrir, mude o estado acima." : " Se ainda precisa de ajuda, escreva abaixo — a equipe será avisada."}
              </span>
            </div>
          )}

          <Conversation messages={ticket.messages} />

          {viewer.viewingAs ? (
            // "Ver como" é só leitura: no lugar da caixa de resposta, o aviso.
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Aqui {viewer.viewingAs.name} responderia ao chamado. No “ver como” nada é enviado em nome de outra pessoa.
            </p>
          ) : (
            <ReplyBox
              ticketId={ticket.id}
              closed={ticket.closed}
              agent={agent ? { canWork: agent.canWork, blockedMessage: blockedMessage(ticket.owner?.name ?? null, agent.canAllocate) } : null}
            />
          )}
        </div>
      </ReplyProvider>
    </ColaboraFrame>
  );
}

// Por que a pessoa não pode responder este chamado (ele não está com ela).
function blockedMessage(ownerName: string | null, canAllocate: boolean): string {
  if (ownerName === null) {
    return canAllocate ? "Este chamado está na fila. Atribua a um agente (acima) para ele atender e responder." : "Este chamado não está atribuído a você.";
  }
  return `Este chamado está com ${ownerName}. Só quem atende responde ao solicitante.`;
}
