import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BellRing, CircleCheck, Download, FileText } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { cn } from "@venore/plugin-sdk/ui";
import { getTicket } from "../../index";
import type { TicketMessage } from "../../index";
import { formatBytes } from "../../shared/answers";
import { ImageLightbox } from "./image-lightbox";
import { initials } from "./palette";
import { BlockedNotice, StateBadge, formatDateTime } from "./shared";
import { ReplyBox, TicketStateButton } from "./ticket-actions";

// /chamados/:ticketId — a conversa do chamado. O Zammad é só o motor por trás: tudo (mensagens,
// anexos, responder, encerrar, reabrir) acontece aqui. Só abre chamado que a própria pessoa abriu.
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

      <ol className="space-y-4" aria-label="Conversa">
        {ticket.messages.map((message, position) => (
          <Message key={message.id} message={message} first={position === 0} />
        ))}
      </ol>

      <ReplyBox ticketId={ticket.id} closed={ticket.closed} />
    </div>
  );
}

function Message({ message, first }: { message: TicketMessage; first: boolean }) {
  const mine = message.role === "me";
  return (
    <li className={cn("flex gap-3", mine && "flex-row-reverse")}>
      <span
        aria-hidden
        className={cn(
          "mt-1 grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold text-foreground ring-2",
          mine ? "bg-primary/20 ring-primary/30" : "bg-chart-2/20 ring-chart-2/30",
        )}
      >
        {message.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          initials(message.authorName)
        )}
      </span>
      <div
        className={cn(
          "min-w-0 max-w-[85%] space-y-2 rounded-xl border p-4",
          mine ? "border-primary/30 bg-primary/10" : "border-chart-2/30 bg-chart-2/10",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            {first && mine ? "Seu pedido" : message.authorName}
            {!mine && <span className="ms-2 text-xs font-normal text-muted-foreground">equipe</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</p>
        </div>
        {message.text && <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">{message.text}</p>}
        {message.answers.length > 0 && (
          <div className="space-y-3 rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Respostas do formulário</p>
            <dl className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {message.answers.map((answer) => (
                <div key={answer.label} className="min-w-0 space-y-0.5">
                  <dt className="text-xs leading-snug text-muted-foreground">{answer.label}</dt>
                  <dd className="text-sm font-medium break-words whitespace-pre-wrap text-foreground">{answer.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {message.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {message.attachments.map((file) =>
              file.isImage ? (
                <li key={file.id}>
                  <ImageLightbox src={file.href} filename={file.filename} />
                </li>
              ) : (
                <li key={file.id}>
                  <a
                    href={file.href}
                    download
                    className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-foreground hover:border-primary/50"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="max-w-48 truncate">{file.filename}</span>
                    <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                    <Download className="size-3.5 text-muted-foreground" />
                  </a>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </li>
  );
}
