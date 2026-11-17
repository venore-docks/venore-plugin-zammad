"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, ExternalLink, FileSearch, Paperclip, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@venore/plugin-sdk/ui";
import type { FlowStepKey } from "../../../../contracts/types";
import type { AssigneeOption } from "../../../../features/get-manager-dashboard/types";
import { REASON_MAX, validateReason } from "../../../../shared/flow";
import type { QueueBucket } from "../../../../shared/queue-buckets";
import { agentUpdateTicketAction, ticketPreviewAction, type TicketPreview } from "../../../public/actions";
import { FlowButton } from "../../../public/flow-actions";
import { FLOW_BUTTON, FLOW_BUTTON_SUBTLE } from "../../../public/palette";
import { formatDateTime } from "../../../public/shared";

// Botão compacto dos cards da fila.
const SMALL = "h-7 gap-1 px-2.5 text-xs font-medium shadow-none [&_svg]:size-3.5";

type DecisionProps = {
  ticketId: number;
  title: string;
  bucket: QueueBucket;
  detailHref: string;
  flowStateIds: Partial<Record<FlowStepKey, number>>;
  options: AssigneeOption[];
  suggestedId: number | null;
};

function useSend() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  function send(update: { stateId?: number; ownerId?: number; reason?: string | null }, ticketId: number, done: string, after?: () => void) {
    startTransition(async () => {
      const result = await agentUpdateTicketAction({ ticketId, ...update });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      after?.();
      router.refresh();
    });
  }
  return { busy, send };
}

function optionLabel(person: AssigneeOption, suggestedId: number | null): string {
  return `${person.name}${person.open !== null ? ` · ${person.open} ${person.open === 1 ? "aberto" : "abertos"}` : ""}${person.id === suggestedId ? " · sugerido" : ""}`;
}

// "Autorizar e atribuir": um só envio com Autorizado + responsável. O gatilho do Zammad
// ("Administrador atribui agente") leva o chamado a Em andamento e avisa o solicitante.
function AuthorizeAndAssign({
  ticketId,
  authorizedId,
  options,
  suggestedId,
  onDone,
}: {
  ticketId: number;
  authorizedId: number | undefined;
  options: AssigneeOption[];
  suggestedId: number | null;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(suggestedId ? String(suggestedId) : "");
  const { busy, send } = useSend();
  if (!authorizedId) return null;
  if (options.length === 0) return <p className="text-xs text-muted-foreground">Nenhum agente atende o setor deste chamado.</p>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={value} onValueChange={setValue} disabled={busy}>
        <SelectTrigger className="h-10 w-full sm:flex-1" aria-label="Atribuir a">
          <SelectValue placeholder="Escolher agente" />
        </SelectTrigger>
        <SelectContent>
          {options.map((person) => (
            <SelectItem key={person.id} value={String(person.id)}>
              {optionLabel(person, suggestedId)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        className={cn("h-10 font-semibold sm:shrink-0", FLOW_BUTTON.primary)}
        disabled={busy || !value}
        onClick={() => send({ stateId: authorizedId, ownerId: Number(value) }, ticketId, "Autorizado e atribuído. O chamado está em andamento.", onDone)}
      >
        <UserCheck className="size-4" />
        {busy ? "Atribuindo…" : "Autorizar e atribuir"}
      </Button>
    </div>
  );
}

// Diálogo "Analisar": resumo do pedido e as decisões do gestor (manter em análise, autorizar, não autorizar,
// ou autorizar já atribuindo um agente).
function AnalyzeDialog({ props, label, icon, variant }: { props: DecisionProps; label: string; icon: React.ReactNode; variant: "primary" | "outline" }) {
  const { ticketId, bucket, detailHref, flowStateIds, options, suggestedId } = props;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<TicketPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const { busy, send } = useSend();

  function openDialog(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setDenying(false);
      setReason("");
      setReasonError(null);
      return;
    }
    if (preview) return;
    setLoadError(null);
    startLoading(async () => {
      const result = await ticketPreviewAction(ticketId);
      if (result.ok) setPreview(result.data);
      else setLoadError(result.error);
    });
  }

  const close = () => openDialog(false);
  const analysisId = flowStateIds.em_analise;
  const authorizedId = flowStateIds.autorizado;
  const deniedId = flowStateIds.nao_autorizado;

  function keepAnalyzing() {
    // Já em análise (ou em reavaliação): manter = só fechar. Novo: passa a Em análise.
    if (bucket !== "novo" || !analysisId) return close();
    send({ stateId: analysisId }, ticketId, "Chamado em análise.", close);
  }

  function deny() {
    const problem = validateReason(reason, true);
    setReasonError(problem);
    if (problem || !deniedId) return;
    send({ stateId: deniedId, reason: reason.trim() }, ticketId, "Chamado não autorizado. O solicitante foi avisado.", close);
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <Button
        type="button"
        onClick={() => openDialog(true)}
        className={cn(SMALL, variant === "primary" ? FLOW_BUTTON_SUBTLE.primary : FLOW_BUTTON_SUBTLE.neutral)}
      >
        {icon}
        {label}
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pe-6 leading-snug">{preview?.title ?? props.title}</DialogTitle>
          <DialogDescription>
            {preview ? `#${preview.number} · ${preview.group} · ${preview.requesterName} · aberto em ${formatDateTime(preview.createdAt)}` : "Carregando o pedido…"}
          </DialogDescription>
        </DialogHeader>

        {loadError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {loadError}
          </p>
        )}
        {loading && !preview && <div className="h-28 animate-pulse rounded-md bg-muted" aria-hidden />}
        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border px-2.5 py-0.5 text-muted-foreground">Estado: {preview.stateLabel}</span>
              <span className="rounded-full border px-2.5 py-0.5 text-muted-foreground">Prioridade: {preview.priorityLabel}</span>
              {preview.attachments > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-muted-foreground">
                  <Paperclip className="size-3" aria-hidden />
                  {preview.attachments} {preview.attachments === 1 ? "anexo" : "anexos"}
                </span>
              )}
            </div>
            {preview.answers.length > 0 && (
              <dl className="grid gap-2.5 rounded-md border bg-muted/40 p-3 text-sm">
                {preview.answers.map((answer) => (
                  <div key={answer.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{answer.label}</dt>
                    <dd className="font-medium break-words text-foreground">{answer.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {preview.text && <p className="max-h-60 overflow-y-auto text-sm whitespace-pre-wrap text-foreground">{preview.text}</p>}
            <Link href={detailHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ExternalLink className="size-3.5" aria-hidden />
              Abrir o chamado completo
            </Link>
          </div>
        )}

        {denying ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <label htmlFor={`deny-${ticketId}`} className="block text-sm font-medium text-foreground">
              Motivo da não autorização <span className="text-destructive">*</span>
              <span className="block text-xs font-normal text-muted-foreground">O solicitante recebe este texto por e-mail e pode reenviar o pedido.</span>
            </label>
            <Textarea
              id={`deny-${ticketId}`}
              rows={4}
              maxLength={REASON_MAX}
              value={reason}
              aria-invalid={Boolean(reasonError)}
              onChange={(event) => setReason(event.target.value)}
            />
            {reasonError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {reasonError}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={busy} onClick={() => setDenying(false)}>
                Voltar
              </Button>
              <Button disabled={busy} onClick={deny} className={cn("font-semibold", FLOW_BUTTON.danger)}>
                <CircleX className="size-4" />
                {busy ? "Enviando…" : "Confirmar: não autorizar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Atribuir já autoriza e coloca o chamado em andamento:</p>
            <AuthorizeAndAssign ticketId={ticketId} authorizedId={authorizedId} options={options} suggestedId={suggestedId} onDone={close} />
            <DialogFooter className="gap-2 pt-1 sm:justify-start">
              {analysisId && (
                <Button disabled={busy} onClick={keepAnalyzing} className={cn("h-10 font-semibold", FLOW_BUTTON.warning)}>
                  <Search className="size-4" />
                  Manter em análise
                </Button>
              )}
              {authorizedId && (
                <Button
                  disabled={busy}
                  onClick={() => send({ stateId: authorizedId }, ticketId, "Chamado autorizado. Agora atribua um responsável.", close)}
                  className={cn("h-10 font-semibold", FLOW_BUTTON.success)}
                >
                  <CircleCheck className="size-4" />
                  Autorizar
                </Button>
              )}
              {deniedId && (
                <Button disabled={busy} onClick={() => setDenying(true)} className={cn("h-10 font-semibold", FLOW_BUTTON.danger)}>
                  <CircleX className="size-4" />
                  Não autorizar
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


// "Atribuir" com confirmação: escolhe o agente num diálogo e confirma. `authorizedId` presente = autoriza junto
// (Em análise/Reavaliação); ausente = só atribui (Autorizado). Nos dois casos o gatilho do Zammad leva o chamado a
// Em andamento e avisa o solicitante.
function AssignDialog({
  ticketId,
  authorizedId,
  options,
  suggestedId,
}: {
  ticketId: number;
  authorizedId?: number;
  options: AssigneeOption[];
  suggestedId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(suggestedId ? String(suggestedId) : "");
  const { busy, send } = useSend();
  const chosen = options.find((person) => String(person.id) === value);

  function confirm() {
    if (!value) return;
    const update = authorizedId ? { stateId: authorizedId, ownerId: Number(value) } : { ownerId: Number(value) };
    send(update, ticketId, authorizedId ? "Autorizado e atribuído. O chamado está em andamento." : "Chamado atribuído. Está em andamento.", () => setOpen(false));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button type="button" disabled={options.length === 0} onClick={() => setOpen(true)} className={cn(SMALL, FLOW_BUTTON_SUBTLE.primary)}>
        <UserCheck className="size-3.5" />
        Atribuir
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{authorizedId ? "Autorizar e atribuir" : "Atribuir responsável"}</DialogTitle>
          <DialogDescription>
            {authorizedId ? "O pedido será autorizado e vai para Em andamento com o agente escolhido." : "O chamado vai para Em andamento com o agente escolhido."} O solicitante
            é avisado por e-mail.
          </DialogDescription>
        </DialogHeader>
        <Select value={value} onValueChange={setValue} disabled={busy}>
          <SelectTrigger className="h-10 w-full" aria-label="Agente">
            <SelectValue placeholder="Escolher agente" />
          </SelectTrigger>
          <SelectContent>
            {options.map((person) => (
              <SelectItem key={person.id} value={String(person.id)}>
                {optionLabel(person, suggestedId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button disabled={busy || !value} onClick={confirm} className={cn("font-semibold", FLOW_BUTTON.primary)}>
            <UserCheck className="size-4" />
            {busy ? "Atribuindo…" : chosen ? `Atribuir a ${chosen.name.split(" ")[0]}` : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Ações do card da fila do gestor, por etapa (botões compactos, todos com confirmação):
//   Novo                     Analisar (diálogo com resumo e decisões)
//   Em análise / Reavaliação Atribuir (autoriza e atribui) · Autorizar · Não autorizar (o título abre o chamado)
//   Autorizado               Atribuir
//   Não autorizado           aguardando o solicitante
//   Atribuídos               Ver atendimento
export function DecisionActions(props: DecisionProps) {
  const { ticketId, bucket, flowStateIds, options, suggestedId, detailHref } = props;
  const row = "flex flex-wrap items-center gap-1.5";

  if (bucket === "novo") {
    return (
      <div className={row}>
        <AnalyzeDialog props={props} label="Analisar" icon={<FileSearch className="size-3.5" />} variant="primary" />
      </div>
    );
  }
  if (bucket === "analise" || bucket === "reavaliacao") {
    const authorizedId = flowStateIds.autorizado;
    const deniedId = flowStateIds.nao_autorizado;
    return (
      <div className={row}>
        {authorizedId && <AssignDialog ticketId={ticketId} authorizedId={authorizedId} options={options} suggestedId={suggestedId} />}
        {authorizedId && (
          <FlowButton
            size="sm"
            label="Autorizar"
            color="success"
            icon={<CircleCheck className="size-3.5" />}
            prompt="O pedido fica autorizado, esperando um responsável."
            reason="none"
            confirmTitle="Autorizar este chamado?"
            confirmLabel="Autorizar"
            run={async () => {
              const result = await agentUpdateTicketAction({ ticketId, stateId: authorizedId });
              return result.ok ? { ok: true, message: "Chamado autorizado. Agora atribua um responsável." } : result;
            }}
          />
        )}
        {deniedId && (
          <FlowButton
            size="sm"
            label="Não autorizar"
            color="danger"
            icon={<CircleX className="size-3.5" />}
            prompt="Explique o motivo. O solicitante recebe este texto por e-mail e pode reenviar o pedido."
            reason="required"
            confirmTitle="Não autorizar este chamado?"
            confirmLabel="Não autorizar"
            run={async (reason) => {
              const result = await agentUpdateTicketAction({ ticketId, stateId: deniedId, reason });
              return result.ok ? { ok: true, message: "Chamado não autorizado. O solicitante foi avisado." } : result;
            }}
          />
        )}
      </div>
    );
  }
  if (bucket === "autorizado") {
    return options.length === 0 ? (
      <p className="text-xs text-muted-foreground">Nenhum agente atende este setor.</p>
    ) : (
      <div className={row}>
        <AssignDialog ticketId={ticketId} options={options} suggestedId={suggestedId} />
      </div>
    );
  }
  if (bucket === "nao_autorizado") {
    return <p className="text-xs text-muted-foreground">Aguardando o solicitante reenviar.</p>;
  }
  return (
    <Button asChild variant="outline" className={cn(SMALL, FLOW_BUTTON_SUBTLE.neutral)}>
      <Link href={detailHref}>
        <ExternalLink className="size-3.5" aria-hidden />
        Ver atendimento
      </Link>
    </Button>
  );
}
