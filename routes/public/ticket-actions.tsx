"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Lock, Paperclip, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Textarea,
  cn,
} from "@venore/plugin-sdk/ui";
import { ATTACHMENT_LIMITS, DESCRIPTION_MAX, formatBytes, validateAttachments, validateReply } from "../../shared/answers";
import { changeTicketStateAction, replyTicketAction } from "./actions";
import { useReplyQuote } from "./reply-context";

// Encerrar (com confirmação — é fácil clicar sem querer) ou reabrir o chamado.
export function TicketStateButton({ ticketId, closed }: { ticketId: number; closed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(action: "close" | "reopen") {
    startTransition(async () => {
      const result = await changeTicketStateAction(ticketId, action);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(action === "close" ? "Chamado encerrado." : "Chamado reaberto.");
      // Dentro da mesma transição: o botão segue ocupado até a tela atualizar (evita o segundo clique).
      startTransition(() => router.refresh());
    });
  }

  if (closed) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => change("reopen")}>
        <RotateCcw className="size-3.5" />
        Reabrir chamado
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <CircleCheck className="size-3.5" />
          Já resolveu? Encerrar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar este chamado?</AlertDialogTitle>
          <AlertDialogDescription>A equipe será avisada de que o assunto foi resolvido. Se precisar, você pode reabrir depois.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ainda não</AlertDialogCancel>
          <AlertDialogAction onClick={() => change("close")}>Sim, encerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// `agent` = visão do agente (app): responde ao solicitante (e-mail) ou escreve nota interna. Sem `agent`,
// é o solicitante conversando. `canWork` falso = o chamado não está com a pessoa (fila ou de outro agente):
// só quem atende responde; `blockedMessage` explica.
type DraftKind = "reply" | "note";

function noopSubscribe(): () => void {
  return () => {};
}

function draftKey(ticketId: number, kind: DraftKind): string {
  return `colabora:draft:${ticketId}:${kind}`;
}

function readDraft(ticketId: number, kind: DraftKind): string {
  try {
    return window.sessionStorage.getItem(draftKey(ticketId, kind)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(ticketId: number, kind: DraftKind, text: string) {
  try {
    if (text) window.sessionStorage.setItem(draftKey(ticketId, kind), text);
    else window.sessionStorage.removeItem(draftKey(ticketId, kind));
  } catch {
    // sessionStorage indisponível (modo privado, bloqueado): o rascunho só vive na tela.
  }
}

export function ReplyBox({ ticketId, closed, agent = null }: { ticketId: number; closed: boolean; agent?: { canWork: boolean; blockedMessage?: string } | null }) {
  const router = useRouter();
  // Um rascunho por aba (resposta ao solicitante × nota interna): trocar de aba não perde o que foi escrito.
  // `edited` guarda o que foi digitado nesta visita; enquanto a aba não foi editada, vale o que estava no sessionStorage
  // (lido por useSyncExternalStore: "" no servidor e na hidratação, sem divergência).
  const [edited, setDrafts] = useState<Partial<Record<DraftKind, string>>>({});
  const savedReply = useSyncExternalStore(noopSubscribe, () => readDraft(ticketId, "reply"), () => "");
  const savedNote = useSyncExternalStore(noopSubscribe, () => readDraft(ticketId, "note"), () => "");
  const drafts: Record<DraftKind, string> = { reply: edited.reply ?? savedReply, note: edited.note ?? savedNote };
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [chosenInternal, setChosenInternal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { quote, setQuote } = useReplyQuote();
  // Citar uma nota interna só é permitido em outra nota interna: força o modo.
  const internal = Boolean(agent) && (chosenInternal || Boolean(quote?.internal));
  const kind: DraftKind = internal ? "note" : "reply";
  const message = drafts[kind];

  function setMessage(text: string) {
    setDrafts((current) => ({ ...current, [kind]: text }));
    writeDraft(ticketId, kind, text);
  }

  if (agent && !agent.canWork) {
    return (
      <div id="responder" className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {agent.blockedMessage ?? "Este chamado não está com você."}
      </div>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateReply(message) ?? validateAttachments(files);
    setError(problem);
    if (problem) return;

    const formData = new FormData();
    formData.set("ticketId", String(ticketId));
    formData.set("message", message);
    if (quote) formData.set("quoteArticleId", String(quote.articleId));
    if (agent) formData.set("asAgent", "1");
    if (internal) formData.set("internal", "1");
    files.forEach((file) => formData.append("attachments", file));
    startTransition(async () => {
      const result = await replyTicketAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(internal ? "Nota salva." : result.data.reopened ? "Mensagem enviada e chamado reaberto." : "Mensagem enviada.");
      setMessage("");
      setFiles([]);
      setQuote(null);
      // Dentro da mesma transição: o botão segue ocupado até a tela atualizar (evita o segundo clique).
      startTransition(() => router.refresh());
    });
  }

  // Regra de design: caixa neutra; só a nota interna ganha cor (âmbar tracejado), porque ali a cor evita um erro.
  // As explicações de cada modo vão no placeholder; contador só perto do limite; limite de anexos no `title`.
  const nearLimit = message.length >= DESCRIPTION_MAX * 0.9;
  const tab =
    "-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-0.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50";
  return (
    <form
      ref={formRef}
      id="responder"
      onSubmit={submit}
      className={cn("scroll-mt-24 space-y-3 rounded-lg border p-4", internal ? "border-dashed border-warning-border bg-warning-soft" : "bg-card")}
      noValidate
    >
      {agent ? (
        <div role="group" aria-label="Tipo de mensagem" className={cn("flex gap-5 border-b", internal && "border-warning-border")}>
          <button
            type="button"
            aria-pressed={!internal}
            disabled={Boolean(quote?.internal)}
            onClick={() => setChosenInternal(false)}
            className={cn(tab, !internal ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            Responder
            {drafts.reply.trim() && internal && <span aria-label="rascunho guardado" className="size-1.5 rounded-full bg-primary" />}
          </button>
          <button
            type="button"
            aria-pressed={internal}
            onClick={() => setChosenInternal(true)}
            className={cn(tab, internal ? "border-warning font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            <Lock className="size-3.5" />
            Nota interna
            {drafts.note.trim() && !internal && <span aria-label="rascunho guardado" className="size-1.5 rounded-full bg-warning" />}
          </button>
        </div>
      ) : (
        <label htmlFor="reply-message" className="block font-medium text-foreground">
          {closed ? "Precisa de mais alguma coisa? Escreva aqui" : "Responder à equipe"}
        </label>
      )}
      {quote && (
        <div className="flex items-start gap-3 rounded-md border-s-2 border-s-foreground/30 bg-muted/50 p-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs font-semibold text-foreground">Respondendo a {quote.author}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{quote.preview}</p>
          </div>
          <button
            type="button"
            aria-label="Cancelar resposta a esta mensagem"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setQuote(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <Textarea
        id="reply-message"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/Cmd+Enter envia (só no modo agente, onde a caixa é de trabalho).
          if (agent && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder={
          internal ? "Só a equipe vê esta nota. O solicitante não recebe nada…" : agent ? "Escreva ao solicitante. Ele recebe por e-mail…" : "Escreva a sua mensagem…"
        }
        aria-invalid={Boolean(error)}
        className={cn("text-base", internal && "bg-card")}
      />
      {nearLimit && (
        <p className={cn("text-end text-xs tabular-nums", message.length > DESCRIPTION_MAX ? "font-medium text-destructive" : "text-muted-foreground")}>
          {message.length.toLocaleString("pt-BR")} / {DESCRIPTION_MAX.toLocaleString("pt-BR")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, position) => (
            <li key={`${file.name}-${position}`} className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-foreground">{file.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {formatBytes(file.size)}
                <button
                  type="button"
                  aria-label={`Remover ${file.name}`}
                  className="rounded p-1 hover:bg-muted"
                  onClick={() => setFiles(files.filter((_, other) => other !== position))}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              setFiles([...files, ...Array.from(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={`Anexar (até ${ATTACHMENT_LIMITS.maxFiles} arquivos, ${formatBytes(ATTACHMENT_LIMITS.maxTotalBytes)})`}
            onClick={() => inputRef.current?.click()}
            disabled={files.length >= ATTACHMENT_LIMITS.maxFiles}
            className="text-muted-foreground"
          >
            <Paperclip className="size-4" />
            Anexar
          </Button>
        </div>
        <Button type="submit" variant={internal ? "outline" : "default"} disabled={pending} title={agent ? "Ctrl+Enter (⌘+Enter) envia" : undefined}>
          <Send className="size-4" />
          {pending ? "Enviando…" : internal ? "Salvar nota" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
