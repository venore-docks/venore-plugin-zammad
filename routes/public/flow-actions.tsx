"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, MessageSquareWarning, PlayCircle, RotateCcw, Search, Send, ThumbsUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
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
import type { CustomerActionKey, CustomerActionOption, StaffFlowAction, TicketStateColor } from "../../contracts/types";
import { REASON_MAX, validateReason } from "../../shared/flow";
import { agentUpdateTicketAction, customerRespondAction } from "./actions";
import { FLOW_BADGE, FLOW_BUTTON } from "./palette";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

type FlowButtonProps = {
  label: string;
  color: TicketStateColor;
  icon: ReactElement;
  // Pergunta do diálogo (o que a pessoa precisa explicar).
  prompt: string;
  reason: "required" | "optional" | "none";
  confirmTitle: string;
  confirmLabel: string;
  disabled?: boolean;
  // "sm": botão compacto (cards de lista); "default": botão de painel.
  size?: "default" | "sm";
  run: (reason: string) => Promise<ActionResult>;
};

// Botão de decisão do fluxo: cheio, na cor semântica (tokens do tema), e SEMPRE com confirmação — é fácil
// clicar sem querer, e a decisão notifica outra pessoa. Com `reason`, o diálogo pede o texto.
export function FlowButton({ label, color, icon, prompt, reason, confirmTitle, confirmLabel, disabled, size = "default", run }: FlowButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function confirm() {
    const problem = reason === "none" ? null : validateReason(text, reason === "required");
    setError(problem);
    if (problem) return;
    startTransition(async () => {
      const result = await run(text.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setText("");
      router.refresh();
    });
  }

  const fieldId = `flow-reason-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          disabled={disabled || busy}
          className={cn(
            "justify-center font-semibold",
            size === "sm" ? "h-8 gap-1.5 px-3 text-xs [&_svg]:size-3.5" : "h-11 w-full gap-2 shadow-sm @md:w-auto",
            FLOW_BUTTON[color],
          )}
        >
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          {reason === "none" ? (
            <AlertDialogDescription>{prompt || "Confirme para continuar."}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription asChild>
              <label htmlFor={fieldId} className="block text-sm text-muted-foreground">
                {prompt}
                {reason === "required" && <span className="text-destructive"> *</span>}
              </label>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {reason !== "none" && (
          <Textarea
            id={fieldId}
            rows={4}
            maxLength={REASON_MAX}
            value={text}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            onChange={(event) => setText(event.target.value)}
            className="min-h-28"
          />
        )}
        {error && (
          <p id={`${fieldId}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
          <Button type="button" disabled={busy} onClick={confirm} className={cn("font-semibold", FLOW_BUTTON[color])}>
            {busy ? "Enviando…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const CUSTOMER_ICONS: Record<CustomerActionKey, ReactElement> = {
  approve: <ThumbsUp className="size-4" />,
  adjust: <MessageSquareWarning className="size-4" />,
  not_solved: <TriangleAlert className="size-4" />,
  reject: <CircleX className="size-4" />,
  resubmit: <Send className="size-4" />,
};

// Painel de decisão do SOLICITANTE (Concluído: aprovar/ajustes/não resolvido/rejeitar; Não autorizado:
// reenviar). Destacado na cor do passo para chamar a atenção logo abaixo do cabeçalho do chamado.
export function CustomerDecisionPanel({
  ticketId,
  title,
  hint,
  color,
  actions,
  readOnly,
}: {
  ticketId: number;
  title: string;
  hint: string;
  color: TicketStateColor;
  actions: CustomerActionOption[];
  // "Ver como": mostra os botões, mas nada é enviado.
  readOnly: boolean;
}) {
  if (actions.length === 0) return null;
  const tone = FLOW_BADGE[color];
  return (
    <section aria-label="Sua decisão" className={cn("space-y-3 rounded-xl border-2 p-4 @md:p-5", tone.soft)}>
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <CircleCheck className={cn("size-5 shrink-0", tone.icon)} />
          {title}
        </h3>
        <p className="text-sm text-foreground/80">{hint}</p>
      </div>
      <div className="grid gap-2 @md:flex @md:flex-wrap">
        {actions.map((action) => (
          <FlowButton
            key={action.key}
            label={action.label}
            color={action.color}
            icon={CUSTOMER_ICONS[action.key]}
            prompt={action.prompt}
            reason={action.reasonRequired ? "required" : "optional"}
            confirmTitle={`${action.label}?`}
            confirmLabel={action.label}
            disabled={readOnly}
            run={async (reason) => {
              const result = await customerRespondAction({ ticketId, action: action.key, reason });
              return result.ok ? { ok: true, message: result.data.message } : result;
            }}
          />
        ))}
      </div>
      {readOnly && <p className="text-xs text-muted-foreground">No “ver como” os botões não enviam nada.</p>}
    </section>
  );
}

const STAFF_ICONS: Record<TicketStateColor, ReactElement> = {
  warning: <Search className="size-4" />,
  success: <CircleCheck className="size-4" />,
  danger: <CircleX className="size-4" />,
  primary: <PlayCircle className="size-4" />,
  info: <PlayCircle className="size-4" />,
  neutral: <RotateCcw className="size-4" />,
};

// Atalhos do fluxo para a EQUIPE (Iniciar análise, Autorizar, Não autorizar, Concluir…).
export function StaffFlowButtons({ ticketId, actions, disabled }: { ticketId: number; actions: StaffFlowAction[]; disabled?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <div className="grid gap-2 @md:flex @md:flex-wrap">
      {actions.map((action) => (
        <FlowButton
          key={action.stateId}
          label={action.label}
          color={action.color}
          icon={STAFF_ICONS[action.color]}
          prompt={action.prompt}
          reason={action.reason}
          confirmTitle={`${action.label} este chamado?`}
          confirmLabel={action.label}
          disabled={disabled}
          run={async (reason) => {
            const result = await agentUpdateTicketAction({ ticketId, stateId: action.stateId, reason: reason || null });
            return result.ok ? { ok: true, message: action.done } : result;
          }}
        />
      ))}
    </div>
  );
}
