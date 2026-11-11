import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BellRing, CircleCheck } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getTicket } from "../../index";
import { Conversation } from "./conversation";
import { ReplyProvider } from "./reply-context";
import { BlockedNotice, StateBadge, formatDateTime } from "./shared";
import { ReplyBox, TicketStateButton } from "./ticket-actions";

// /chamados/:ticketId — a conversa do chamado. O Zammad é só o motor por trás: tudo (mensagens,
// anexos, responder, encerrar, reabrir) acontece aqui. Só abre chamado que a própria pessoa abriu.
// (O agente trabalha os chamados atribuídos a ele no app: /ext/zammad/app.)
export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await isPluginActive("zammad"))) notFound();
  const { ticketId } = await params;
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect(`/login?callbackUrl=${encodeURIComponent(`/chamados/${ticketId}`)}`);

  const result = await getTicket({ ticketId: Number(ticketId) });
  if (!result.success) {
    return (
      <div className="py-10">
        <BlockedNotice title="Chamado" message={result.error.message} showBack />
      </div>
    );
  }
  const ticket = result.data;

  return (
    <ReplyProvider>
      <div className="mx-auto max-w-3xl space-y-6 py-10">
        <Link href="/chamados" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Meus chamados
        </Link>

        <header className="space-y-3 rounded-xl border border-t-4 border-t-primary bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight break-words text-foreground sm:text-2xl">{ticket.title}</h1>
            <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
          </div>
          <p className="text-sm text-muted-foreground">
            #{ticket.number} · {ticket.group} · aberto em {formatDateTime(ticket.createdAt)}
          </p>
          {ticket.canClose && <TicketStateButton ticketId={ticket.id} closed={ticket.closed} />}
        </header>

        {ticket.awaitingYou && (
          <a
            href="#responder"
            className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-foreground hover:bg-warning-soft/70"
          >
            <BellRing className="size-5 shrink-0 text-warning" />
            <span>
              <strong>A equipe respondeu.</strong> Veja a mensagem abaixo e responda se precisar.
            </span>
          </a>
        )}
        {ticket.closed && (
          <div className="flex items-start gap-3 rounded-xl border border-success-border bg-success-soft p-4 text-sm text-foreground">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <span>
              <strong>Este chamado foi encerrado.</strong> Se ainda precisa de ajuda, escreva abaixo — a equipe será avisada.
            </span>
          </div>
        )}

        <Conversation messages={ticket.messages} />

        <ReplyBox ticketId={ticket.id} closed={ticket.closed} />
      </div>
    </ReplyProvider>
  );
}
