"use client";

import { useRef, useState, useTransition } from "react";
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
import { ATTACHMENT_LIMITS, formatBytes, validateAttachments, validateReply } from "../../shared/answers";
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
      router.refresh();
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
// é o solicitante conversando. `canWork` falso = chamado na fila: antes de responder, é preciso assumir.
export function ReplyBox({ ticketId, closed, agent = null }: { ticketId: number; closed: boolean; agent?: { canWork: boolean } | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [chosenInternal, setChosenInternal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { quote, setQuote } = useReplyQuote();
  // Citar uma nota interna só é permitido em outra nota interna: força o modo.
  const internal = Boolean(agent) && (chosenInternal || Boolean(quote?.internal));

  if (agent && !agent.canWork) {
    return (
      <div id="responder" className="rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-foreground">
        Este chamado está na fila. <strong>Assuma</strong> para responder, escrever notas ou mudar o estado.
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
      router.refresh();
    });
  }

  return (
    <form id="responder" onSubmit={submit} className="scroll-mt-24 space-y-3 rounded-xl border border-t-4 border-t-chart-2 bg-card p-5" noValidate>
      {agent ? (
        <div className="space-y-2">
          <div role="group" aria-label="Tipo de mensagem" className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-sm">
            <button
              type="button"
              aria-pressed={!internal}
              disabled={Boolean(quote?.internal)}
              onClick={() => setChosenInternal(false)}
              className={cn("rounded-md px-3 py-1.5 transition-colors disabled:opacity-50", !internal ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              Ao solicitante
            </button>
            <button
              type="button"
              aria-pressed={internal}
              onClick={() => setChosenInternal(true)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors", internal ? "bg-warning-soft font-medium shadow-sm" : "text-muted-foreground")}
            >
              <Lock className="size-3.5" />
              Nota interna
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {internal ? "Só a equipe vê esta nota. O solicitante não recebe nada." : "Vai por e-mail para o solicitante e aparece na conversa dele."}
          </p>
        </div>
      ) : (
        <label htmlFor="reply-message" className="block font-medium text-foreground">
          {closed ? "Precisa de mais alguma coisa? Escreva aqui" : "Responder à equipe"}
        </label>
      )}
      {quote && (
        <div className="flex items-start gap-3 rounded-lg border border-s-4 border-border border-s-chart-6 bg-muted/50 p-3">
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
        placeholder={internal ? "Escreva a nota interna…" : "Escreva a sua mensagem…"}
        aria-invalid={Boolean(error)}
        className={cn("text-base", internal && "border-dashed border-warning-border bg-warning-soft")}
      />
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
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={files.length >= ATTACHMENT_LIMITS.maxFiles}>
            <Paperclip className="size-3.5" />
            Anexar
          </Button>
          <span className="text-xs text-muted-foreground">Até {ATTACHMENT_LIMITS.maxFiles} arquivos, {formatBytes(ATTACHMENT_LIMITS.maxTotalBytes)}.</span>
        </div>
        <Button type="submit" disabled={pending}>
          <Send className="size-4" />
          {pending ? "Enviando…" : internal ? "Salvar nota" : agent ? "Enviar ao solicitante" : "Enviar mensagem"}
        </Button>
      </div>
    </form>
  );
}
