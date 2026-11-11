import { notFound, redirect } from "next/navigation";
import { BellRing, CircleCheck, UserRound } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getTicket } from "../../index";
import { APP_SURFACE } from "../../shared/routes";
import { Conversation } from "../public/conversation";
import { ReplyProvider } from "../public/reply-context";
import { BlockedNotice, StateBadge, formatDateTime } from "../public/shared";
import { ReplyBox } from "../public/ticket-actions";
import { AgentControls } from "./agent-controls";
import { AppShell } from "./shell";

// /ext/zammad/app/chamado/:ticketId — a conversa no app. Solicitante: como no portal. Agente (chamado com ele
// ou na fila): vê notas internas e o solicitante, e tem os controles de atendimento.
export default async function AppTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await isPluginActive("zammad"))) notFound();
  const { ticketId } = await params;
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect(`/login?callbackUrl=${encodeURIComponent(APP_SURFACE.detail(Number(ticketId)))}`);

  const result = await getTicket({ ticketId: Number(ticketId), asAgent: true });
  if (!result.success) {
    return (
      <AppShell title="Chamado" backHref={APP_SURFACE.list}>
        <BlockedNotice title="Chamado" message={result.error.message} />
      </AppShell>
    );
  }
  const ticket = result.data;
  const agent = ticket.agent;

  return (
    <AppShell title={`#${ticket.number}`} subtitle={ticket.group} backHref={APP_SURFACE.list}>
      <ReplyProvider>
        <div className="space-y-4 pb-6">
          <header className="space-y-3 rounded-xl border border-t-4 border-t-primary bg-card p-4">
            <h2 className="text-lg leading-snug font-semibold break-words text-foreground">{ticket.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
              {agent && <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">Prioridade: {ticket.priorityLabel}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
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
          </header>

          {agent && (
            <AgentControls
              key={`${ticket.id}-${agent.stateId}-${agent.priorityId}-${agent.canWork}`}
              ticketId={ticket.id}
              controls={agent}
              unassigned={ticket.owner === null}
            />
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

          <ReplyBox ticketId={ticket.id} closed={ticket.closed} agent={agent ? { canWork: agent.canWork } : null} />
        </div>
      </ReplyProvider>
    </AppShell>
  );
}
