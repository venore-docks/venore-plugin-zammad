"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Paperclip, RotateCcw, Send, X } from "lucide-react";
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
} from "@venore/plugin-sdk/ui";
import { ATTACHMENT_LIMITS, formatBytes, validateAttachments, validateReply } from "../../shared/answers";
import { changeTicketStateAction, replyTicketAction } from "./actions";

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

export function ReplyBox({ ticketId, closed }: { ticketId: number; closed: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateReply(message) ?? validateAttachments(files);
    setError(problem);
    if (problem) return;

    const formData = new FormData();
    formData.set("ticketId", String(ticketId));
    formData.set("message", message);
    files.forEach((file) => formData.append("attachments", file));
    startTransition(async () => {
      const result = await replyTicketAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.reopened ? "Mensagem enviada e chamado reaberto." : "Mensagem enviada.");
      setMessage("");
      setFiles([]);
      router.refresh();
    });
  }

  return (
    <form id="responder" onSubmit={submit} className="scroll-mt-24 space-y-3 rounded-xl border border-t-4 border-t-chart-2 bg-card p-5" noValidate>
      <label htmlFor="reply-message" className="block font-medium text-foreground">
        {closed ? "Precisa de mais alguma coisa? Escreva aqui" : "Responder à equipe"}
      </label>
      <Textarea
        id="reply-message"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Escreva a sua mensagem…"
        aria-invalid={Boolean(error)}
        className="text-base"
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
          {pending ? "Enviando…" : "Enviar mensagem"}
        </Button>
      </div>
    </form>
  );
}
