import { ChevronRight, Download, FileText, Lock } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { TicketMessage } from "../../index";
import { formatBytes } from "../../shared/answers";
import { makeExcerpt } from "../../shared/html-text";
import { ImageLightbox } from "./image-lightbox";
import { initials } from "./palette";
import { ReplyToButton } from "./reply-context";
import { formatDateTime } from "./shared";

// A conversa do chamado, igual no portal e no app. Regra de design: quem fala é dito pelo LADO e pelo NOME,
// sem cor por papel.
//   me        você — à direita, superfície muted
//   team      equipe — à esquerda, cartão
//   customer  solicitante (só na visão do agente) — à esquerda, cartão; o nome diz quem é
//   internal  nota interna (só na visão do agente) — o único com cor (âmbar tracejado): nunca vai ao solicitante
export function Conversation({ messages }: { messages: TicketMessage[] }) {
  return (
    <ol className="space-y-5" aria-label="Conversa">
      {messages.map((message, position) => (
        <Message key={message.id} message={message} first={position === 0} />
      ))}
    </ol>
  );
}

function Message({ message, first }: { message: TicketMessage; first: boolean }) {
  const mine = message.role === "me";
  const author = mine ? (first && !message.internal ? "Seu pedido" : "Você") : message.authorName;
  return (
    // id + :target — o cartão de citação rola até aqui e a mensagem ganha um anel por um instante.
    <li
      id={`msg-${message.id}`}
      className={cn("flex scroll-mt-24 gap-3 [&:target_[data-bubble]]:ring-2 [&:target_[data-bubble]]:ring-ring", mine && "justify-end")}
    >
      {!mine && (
        <span aria-hidden className="mt-6 hidden size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground sm:grid">
          {message.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            initials(message.authorName)
          )}
        </span>
      )}
      <div className="min-w-0 max-w-full space-y-1.5 sm:max-w-[85%]">
        <p className={cn("flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground", mine && "justify-end")}>
          {message.internal && <Lock className="size-3 text-warning" aria-hidden />}
          {message.internal && <span className="font-medium text-foreground">Nota interna ·</span>}
          <span className="font-medium text-foreground">{author}</span>
          <span aria-hidden>·</span>
          <span>{formatDateTime(message.createdAt)}</span>
        </p>
        <div
          data-bubble
          className={cn(
            "space-y-3 rounded-lg border p-3 sm:p-4",
            message.internal ? "border-dashed border-warning-border bg-warning-soft" : mine ? "bg-muted" : "bg-card",
          )}
        >
          {message.quote && <QuoteCard quote={message.quote} />}
          {message.text && <p className="text-base leading-relaxed break-words whitespace-pre-wrap text-foreground sm:text-sm">{message.text}</p>}
          {message.answers.length > 0 && (
            // Recolhido: no 1º artigo o resumo do formulário costuma ser longo; a equipe abre quando precisa.
            <details className="group" open={!message.text}>
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden />
                Respostas do formulário ({message.answers.length})
              </summary>
              <dl className="mt-3 grid gap-y-2.5">
                {message.answers.map((answer) => (
                  <div key={answer.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{answer.label}</dt>
                    <dd className="text-sm break-words whitespace-pre-wrap text-foreground">{answer.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {message.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {message.attachments.map((file) =>
                file.isImage ? (
                  <li key={file.id}>
                    <ImageLightbox src={file.href} filename={file.filename} />
                  </li>
                ) : (
                  <li key={file.id}>
                    <a href={file.href} download className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted">
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
          {!mine && (
            <div className="-mb-1 flex justify-end">
              <ReplyToButton quote={{ articleId: message.id, author: message.authorName, preview: makeExcerpt(message.text, 160) || "(anexo)", internal: message.internal }} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// Cartão "esta mensagem responde a…" no topo da mensagem. Com o original localizado, vira link que rola até ele.
function QuoteCard({ quote }: { quote: NonNullable<TicketMessage["quote"]> }) {
  const body = (
    <>
      <span className="block text-xs font-semibold text-foreground">{quote.author}</span>
      <span className="line-clamp-2 block text-sm text-muted-foreground">{quote.excerpt}</span>
    </>
  );
  const classes = "block space-y-0.5 rounded-md border-s-2 border-s-foreground/30 bg-background/70 px-3 py-2";
  return quote.targetId ? (
    <a href={`#msg-${quote.targetId}`} className={cn(classes, "transition-colors hover:bg-background")} title="Ir para a mensagem original">
      {body}
    </a>
  ) : (
    <div className={classes}>{body}</div>
  );
}
