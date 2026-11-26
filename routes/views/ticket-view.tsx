import Link from "next/link";
import { BellRing, CircleCheck, Plus } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { Conversation } from "../public/conversation";
import { ReplyProvider } from "../public/reply-context";
import { BlockedNotice, formatDateTime } from "../public/shared";
import { ReplyBox } from "../public/ticket-actions";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";
import { loadTicketForView } from "./ticket-data";
import { TicketProperties } from "./ticket-properties";

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

  const result = await loadTicketForView(ticketId);
  if (!result.success) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active={null} title="Chamado" backHref={surface.mine}>
        <BlockedNotice title="Chamado" message={result.error.message} />
      </ColaboraFrame>
    );
  }
  const ticket = result.data;
  const agent = ticket.agent;
  // Chamado filho volta para o PAI (que, se também for filho, volta para o dele…): a cadeia inteira de volta até o
  // chamado raiz, que então volta para a lista.
  const backHref = ticket.parent ? surface.detail(ticket.parent.id) : agent ? (ticket.owner === null ? surface.queue : surface.assigned) : surface.mine;
  const backLabel = ticket.parent ? `Voltar ao chamado pai #${ticket.parent.number}` : undefined;

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active={null}
      title={surfaceKey === "app" ? `#${ticket.number}` : ticket.title}
      subtitle={surfaceKey === "app" ? ticket.group : `#${ticket.number} · ${ticket.group} · aberto em ${formatDateTime(ticket.createdAt)}`}
      backHref={backHref}
      backLabel={backLabel}
    >
      <ReplyProvider>
        <div className="max-w-3xl space-y-4 pb-6">
          {/* Portal: no desktop as propriedades estão na barra contextual (ticket-sidebar.tsx) e aqui fica só a
              conversa; no celular e no app, empilhadas acima dela. */}
          <div className={surfaceKey === "portal" ? "lg:hidden" : undefined}>
            <TicketProperties ticket={ticket} surfaceKey={surfaceKey} readOnly={Boolean(viewer.viewingAs)} />
          </div>

          {agent && ticket.customerWaiting && (
            <div className="flex items-center gap-3 rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-foreground">
              <BellRing className="size-5 shrink-0 text-warning" />
              <span>
                <strong>O solicitante respondeu.</strong> Veja a última mensagem e responda.
              </span>
            </div>
          )}
          {!agent && ticket.awaitingYou && ticket.customerActions.length === 0 && ticket.customerCanReply && (
            <a href="#responder" className="flex items-center gap-3 rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-foreground">
              <BellRing className="size-5 shrink-0 text-warning" />
              <span>
                <strong>A equipe respondeu.</strong> Veja a mensagem abaixo e responda se precisar.
              </span>
            </a>
          )}
          {ticket.flowStep === "finalizado" && (
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-foreground sm:flex-row sm:items-center">
              <CircleCheck className="size-5 shrink-0 text-success" />
              <span className="flex-1">
                <strong>Este chamado foi finalizado.</strong> Precisa de algo mais? Abra um novo chamado.
              </span>
              {!agent && (
                <Button asChild size="sm" variant="outline" className="h-10">
                  <Link href={surface.newTicket}>
                    <Plus className="size-4" />
                    Novo chamado
                  </Link>
                </Button>
              )}
            </div>
          )}
          {ticket.closed && !ticket.flowStep && (
            <div className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm text-foreground">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
              <span>
                <strong>Este chamado está encerrado.</strong>
                {agent ? " Para reabrir, mude o estado em Atendimento." : " Se ainda precisa de ajuda, escreva abaixo — a equipe será avisada."}
              </span>
            </div>
          )}

          <Conversation messages={ticket.messages} />

          {viewer.viewingAs ? (
            // "Ver como" é só leitura: no lugar da caixa de resposta, o aviso.
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Aqui {viewer.viewingAs.name} responderia ao chamado. No “ver como” nada é enviado em nome de outra pessoa.
            </p>
          ) : !agent && !ticket.customerCanReply ? (
            // Fluxo da FEM: em Concluído/Não autorizado a resposta é pelos botões; em Finalizado, novo chamado.
            ticket.flowStep === "finalizado" ? null : (
              <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{ticket.customerReplyBlocked}</p>
            )
          ) : (
            <ReplyBox
              ticketId={ticket.id}
              closed={ticket.closed}
              agent={agent ? { canWork: agent.canComment, blockedMessage: blockedMessage(ticket.owner?.name ?? null, agent.canAllocate) } : null}
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
    return canAllocate ? "Este chamado está na fila. Atribua a um agente (em Responsável) para ele atender e responder." : "Este chamado não está atribuído a você.";
  }
  return `Este chamado está com ${ownerName}. Só quem atende responde ao solicitante.`;
}
