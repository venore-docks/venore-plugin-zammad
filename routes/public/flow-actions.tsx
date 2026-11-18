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

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

// Peso visual do botão (regra de design: uma ação principal por bloco).
//   primary  botão cheio — o caminho esperado
//   outline  alternativa
//   link     caminho negativo ou raro, em texto
export type FlowEmphasis = "primary" | "outline" | "link";

type FlowButtonProps = {
  label: string;
  color: TicketStateColor;
  icon?: ReactElement;
  emphasis: FlowEmphasis;
  // Pergunta do diálogo (o que a pessoa precisa explicar).
  prompt: string;
  reason: "required" | "optional" | "none";
  confirmTitle: string;
  confirmLabel: string;
  disabled?: boolean;
  run: (reason: string) => Promise<ActionResult>;
};

const TRIGGER: Record<FlowEmphasis, string> = {
  primary: "h-10 w-full @md:w-auto",
  outline: "h-10 w-full @md:w-auto",
  link: "h-auto px-0 py-1 text-sm font-normal text-muted-foreground underline-offset-4 hover:bg-transparent hover:text-foreground hover:underline",
};

// Botão de decisão do fluxo. SEMPRE com confirmação: toda mudança de estado do fluxo dispara gatilhos do
// Zammad que avisam outra pessoa. Com `reason`, o diálogo pede o texto. No diálogo, o botão de confirmar só
// fica vermelho quando a decisão é negativa (`color: "danger"`).
export function FlowButton({ label, color, icon, emphasis, prompt, reason, confirmTitle, confirmLabel, disabled, run }: FlowButtonProps) {
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
          variant={emphasis === "primary" ? "default" : emphasis === "outline" ? "outline" : "ghost"}
          disabled={disabled || busy}
          className={TRIGGER[emphasis]}
        >
          {emphasis !== "link" && icon}
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
          <Button type="button" disabled={busy} onClick={confirm} variant={color === "danger" ? "destructive" : "default"}>
            {busy ? "Enviando…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Peso pela posição: 1ª = principal, 2ª = alternativa, demais = texto.
function emphasisAt(index: number): FlowEmphasis {
  return index === 0 ? "primary" : index === 1 ? "outline" : "link";
}

const CUSTOMER_ICONS: Record<CustomerActionKey, ReactElement> = {
  approve: <ThumbsUp className="size-4" />,
  adjust: <MessageSquareWarning className="size-4" />,
  not_solved: <TriangleAlert className="size-4" />,
  reject: <CircleX className="size-4" />,
  resubmit: <Send className="size-4" />,
};

// Painel de decisão do SOLICITANTE (Concluído: aprovar/ajustes/não resolvido/rejeitar; Não autorizado:
// reenviar). Cartão neutro: o botão principal já chama a atenção; os caminhos negativos ficam em texto.
export function CustomerDecisionPanel({
  ticketId,
  title,
  hint,
  note,
  actions,
  readOnly,
}: {
  ticketId: number;
  title: string;
  hint: string;
  /** Nota de rodapé (ex.: prazo de finalização automática). */
  note?: string;
  actions: CustomerActionOption[];
  // "Ver como": mostra os botões, mas nada é enviado.
  readOnly: boolean;
}) {
  if (actions.length === 0) return null;
  const buttons = actions.slice(0, 2);
  const links = actions.slice(2);
  const render = (action: CustomerActionOption, index: number) => (
    <FlowButton
      key={action.key}
      label={action.label}
      color={action.color}
      icon={CUSTOMER_ICONS[action.key]}
      emphasis={emphasisAt(index)}
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
  );
  return (
    <section aria-label="Sua decisão" className="@container space-y-4 rounded-lg border bg-card p-4 @md:p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-2 @md:flex @md:flex-wrap">{buttons.map(render)}</div>
      {(links.length > 0 || note) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-2">
          <span className="flex flex-wrap gap-x-4">{links.map((action, index) => render(action, index + 2))}</span>
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </div>
      )}
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

// Próximo passo do fluxo para a EQUIPE (Iniciar análise, Autorizar, Não autorizar, Concluir…). A 1ª ação é a
// principal; as demais, alternativas em contorno (a equipe usa todas com frequência, por isso não viram texto).
export function StaffFlowButtons({ ticketId, actions, disabled }: { ticketId: number; actions: StaffFlowAction[]; disabled?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <div className={cn("grid gap-2 @md:flex @md:flex-wrap")}>
      {actions.map((action, index) => (
        <FlowButton
          key={action.stateId}
          label={action.reason === "required" ? `${action.label}…` : action.label}
          color={action.color}
          icon={STAFF_ICONS[action.color]}
          emphasis={index === 0 ? "primary" : "outline"}
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
