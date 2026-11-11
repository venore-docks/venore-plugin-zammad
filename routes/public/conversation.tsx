import { Download, FileText, Lock } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { TicketMessage } from "../../index";
import { formatBytes } from "../../shared/answers";
import { makeExcerpt } from "../../shared/html-text";
import { ImageLightbox } from "./image-lightbox";
import { initials } from "./palette";
import { ReplyToButton } from "./reply-context";
import { formatDateTime } from "./shared";

// A conversa do chamado, igual no portal e no app. Quem fala:
//   me        você — tingido na cor primária, à direita
//   team      equipe — superfície neutra com faixa azul
//   customer  solicitante (só na visão do agente) — faixa azul-esverdeada
//   internal  nota interna (só na visão do agente) — fundo âmbar tracejado: nunca vai ao solicitante
export function Conversation({ messages }: { messages: TicketMessage[] }) {
  return (
    <ol className="space-y-4" aria-label="Conversa">
      {messages.map((message, position) => (
        <Message key={message.id} message={message} first={position === 0} />
      ))}
    </ol>
  );
}

const BUBBLE: Record<"team" | "customer", string> = {
  team: "border-s-4 border-border border-s-chart-6 bg-card",
  customer: "border-s-4 border-border border-s-chart-2 bg-card",
};
const AVATAR: Record<"team" | "customer", string> = {
  team: "bg-chart-6/20 ring-chart-6/40",
  customer: "bg-chart-2/20 ring-chart-2/40",
};
const BADGE: Record<"team" | "customer", { label: string; className: string }> = {
  team: { label: "equipe", className: "bg-chart-6/15" },
  customer: { label: "solicitante", className: "bg-chart-2/15" },
};

function Message({ message, first }: { message: TicketMessage; first: boolean }) {
  const mine = message.role === "me";
  const other = message.role === "customer" ? "customer" : "team";
  return (
    // id + :target — o cartão de citação rola até aqui e a mensagem ganha um anel por um instante.
    <li
      id={`msg-${message.id}`}
      className={cn("flex scroll-mt-24 gap-3 [&:target>div:last-child]:ring-2 [&:target>div:last-child]:ring-chart-6", mine && "flex-row-reverse")}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1 grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold text-foreground ring-2",
          mine ? "bg-primary/20 ring-primary/30" : AVATAR[other],
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
          message.internal
            ? "border-dashed border-warning-border bg-warning-soft"
            : // Você: tingido na cor primária. Os outros: superfície neutra com faixa lateral — a diferença não
              // depende só do matiz (em temas teal, primário e azul-esverdeado ficam parecidos).
              mine
              ? "border-primary/30 bg-primary/10"
              : BUBBLE[other],
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            {first && mine && !message.internal ? "Seu pedido" : message.authorName}
            {message.internal ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground">
                <Lock className="size-3" />
                nota interna
              </span>
            ) : (
              !mine && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium text-foreground", BADGE[other].className)}>{BADGE[other].label}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</p>
        </div>
        {message.quote && <QuoteCard quote={message.quote} />}
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
        {!mine && (
          <div className="-mb-1 flex justify-end">
            <ReplyToButton quote={{ articleId: message.id, author: message.authorName, preview: makeExcerpt(message.text, 160) || "(anexo)", internal: message.internal }} />
          </div>
        )}
      </div>
    </li>
  );
}

// Cartão "esta mensagem responde a…" no topo da mensagem. Com o original localizado, vira link que
// rola até ele. A cor da faixa segue quem foi citado (equipe = azul).
function QuoteCard({ quote }: { quote: NonNullable<TicketMessage["quote"]> }) {
  const body = (
    <>
      <span className="block text-xs font-semibold text-foreground">{quote.author}</span>
      <span className="line-clamp-2 block text-sm text-muted-foreground">{quote.excerpt}</span>
    </>
  );
  const classes = "block space-y-0.5 rounded-lg border-s-4 border-s-chart-6 bg-background/70 px-3 py-2";
  return quote.targetId ? (
    <a href={`#msg-${quote.targetId}`} className={cn(classes, "transition-colors hover:bg-background")} title="Ir para a mensagem original">
      {body}
    </a>
  ) : (
    <div className={classes}>{body}</div>
  );
}
