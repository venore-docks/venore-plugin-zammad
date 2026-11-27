"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Paperclip, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@venore/plugin-sdk/ui";
import type { FlowStepKey } from "../../../../contracts/types";
import type { AssigneeOption } from "../../../../features/get-manager-dashboard/types";
import { REASON_MAX, validateReason } from "../../../../shared/flow";
import type { QueueBucket } from "../../../../shared/queue-buckets";
import { updateNotice } from "../../../../shared/update-notice";
import { agentUpdateTicketAction, ticketPreviewAction, type TicketPreview } from "../../../public/actions";
import { formatDateTime } from "../../../public/shared";

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
  // Erro da última tentativa, para mostrar junto do botão (além do toast): o diálogo continua aberto.
  const [error, setError] = useState<string | null>(null);
  function send(update: { stateId?: number; ownerId?: number; reason?: string | null }, ticketId: number, done: string, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await agentUpdateTicketAction({ ticketId, ...update });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success([done, updateNotice(result.data)].filter(Boolean).join(" "));
      after?.();
      // Dentro da mesma transição: o botão segue ocupado até a tela atualizar (evita o segundo clique).
      startTransition(() => router.refresh());
    });
  }
  return { busy, send, error };
}

// Escolha do agente: <select> nativo. O Select do Radix dentro de um Dialog consumia o primeiro clique no botão de
// confirmar logo depois de escolher (a camada da lista ainda estava saindo); o nativo não tem essa disputa e, no
// celular, abre o seletor do próprio sistema.
function AgentSelect({
  value,
  onChange,
  disabled,
  options,
  suggestedId,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: AssigneeOption[];
  suggestedId: number | null;
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 ${className ?? ""}`}
    >
      <option value="" disabled>
        Escolher agente
      </option>
      {options.map((person) => (
        <option key={person.id} value={String(person.id)}>
          {optionLabel(person, suggestedId)}
        </option>
      ))}
    </select>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

function optionLabel(person: AssigneeOption, suggestedId: number | null): string {
  return `${person.name}${person.open !== null ? ` · ${person.open} ${person.open === 1 ? "aberto" : "abertos"}` : ""}${person.id === suggestedId ? " · sugerido" : ""}`;
}

// Botão da linha da fila: UM por linha, em contorno (regra de design). O título da linha abre o chamado.
const ROW_BUTTON = "h-8 px-3 text-xs";

// Onde o chamado fica ao ganhar um responsável: Atribuído (o agente inicia o atendimento) ou, num Zammad sem esse
// estado, Em andamento (gatilho "Administrador atribui agente").
function afterAssign(flowStateIds: Partial<Record<FlowStepKey, number>>): { done: string; description: string } {
  return flowStateIds.atribuido
    ? { done: "Chamado atribuído. O agente inicia o atendimento.", description: "O chamado fica Atribuído até o agente iniciar o atendimento. O solicitante é avisado por e-mail." }
    : { done: "Chamado atribuído. Está em andamento.", description: "O chamado vai para Em andamento com o agente escolhido. O solicitante é avisado por e-mail." };
}

// "Autorizar e atribuir": um só envio com Autorizado + responsável; o servidor leva a Atribuído (ver afterAssign).
function AuthorizeAndAssign({
  ticketId,
  authorizedId,
  options,
  suggestedId,
  onDone,
  doneMessage,
}: {
  ticketId: number;
  authorizedId: number | undefined;
  doneMessage: string;
  options: AssigneeOption[];
  suggestedId: number | null;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(suggestedId ? String(suggestedId) : "");
  const { busy, send, error } = useSend();
  if (!authorizedId) return null;
  if (options.length === 0) return <p className="text-xs text-muted-foreground">Nenhum agente atende o setor deste chamado.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AgentSelect value={value} onChange={setValue} disabled={busy} options={options} suggestedId={suggestedId} label="Atribuir a" className="sm:flex-1" />
        <Button
          className="h-10 sm:shrink-0"
          disabled={busy || !value}
          aria-busy={busy}
          onClick={() => send({ stateId: authorizedId, ownerId: Number(value) }, ticketId, doneMessage, onDone)}
        >
          <UserCheck className="size-4" />
          {busy ? "Atribuindo…" : "Autorizar e atribuir"}
        </Button>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

// O botão diz o que a pessoa vai fazer: quem pega um Novo ASSUME a análise; quem volta a um chamado em análise CONTINUA.
export function analyzeLabel(bucket: QueueBucket): string {
  if (bucket === "novo") return "Assumir análise";
  if (bucket === "analise") return "Continuar análise";
  if (bucket === "reavaliacao") return "Reavaliar";
  return "Analisar";
}

// Diálogo "Analisar": resumo do pedido e as decisões do gestor. A principal é "Autorizar e atribuir" (botão
// cheio); "Só autorizar" em contorno; "Manter em análise" e "Não autorizar" em texto. A confirmação de
// "não autorizar" (com motivo) é o único botão vermelho.
function AnalyzeDialog({ props }: { props: DecisionProps }) {
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

  const textLink = "h-auto px-0 py-1 font-normal text-muted-foreground underline-offset-4 hover:bg-transparent hover:text-foreground hover:underline";

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <Button type="button" variant="outline" className={ROW_BUTTON} onClick={() => openDialog(true)}>
        {analyzeLabel(bucket)}
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pe-6 leading-snug">{preview?.title ?? props.title}</DialogTitle>
          <DialogDescription>
            {preview ? `${preview.group} · ${preview.requesterName} · aberto em ${formatDateTime(preview.createdAt)}` : "Carregando o pedido…"}
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
            <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>#{preview.number}</span>
              <span aria-hidden>·</span>
              <span>Prioridade {preview.priorityLabel}</span>
              {preview.attachments > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3" aria-hidden />
                    {preview.attachments} {preview.attachments === 1 ? "anexo" : "anexos"}
                  </span>
                </>
              )}
            </p>
            {preview.answers.length > 0 && (
              <dl className="grid gap-2.5 text-sm">
                {preview.answers.map((answer) => (
                  <div key={answer.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{answer.label}</dt>
                    <dd className="break-words text-foreground">{answer.value}</dd>
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
          <div className="space-y-2 border-t pt-4">
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
              <Button variant="destructive" disabled={busy} onClick={deny}>
                {busy ? "Enviando…" : "Não autorizar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">Atribuir já autoriza o chamado e o deixa com o agente escolhido.</p>
            <AuthorizeAndAssign ticketId={ticketId} authorizedId={authorizedId} options={options} suggestedId={suggestedId} onDone={close} doneMessage={afterAssign(flowStateIds).done} />
            <DialogFooter className="flex-row flex-wrap items-center gap-x-4 gap-y-2 pt-1 sm:justify-start">
              {authorizedId && (
                <Button variant="outline" disabled={busy} onClick={() => send({ stateId: authorizedId }, ticketId, "Chamado autorizado. Agora atribua um responsável.", close)}>
                  Só autorizar
                </Button>
              )}
              {analysisId && (
                <Button variant="ghost" disabled={busy} onClick={keepAnalyzing} className={textLink}>
                  Manter em análise
                </Button>
              )}
              {deniedId && (
                <Button variant="ghost" disabled={busy} onClick={() => setDenying(true)} className={textLink}>
                  Não autorizar…
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// "Atribuir" com confirmação: escolhe o agente num diálogo e confirma (etapa Autorizado). Ver afterAssign.
function AssignDialog({
  ticketId,
  options,
  suggestedId,
  flowStateIds,
}: {
  ticketId: number;
  options: AssigneeOption[];
  suggestedId: number | null;
  flowStateIds: Partial<Record<FlowStepKey, number>>;
}) {
  const after = afterAssign(flowStateIds);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(suggestedId ? String(suggestedId) : "");
  const { busy, send, error } = useSend();
  const chosen = options.find((person) => String(person.id) === value);

  function confirm() {
    if (!value) return;
    send({ ownerId: Number(value) }, ticketId, after.done, () => setOpen(false));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button type="button" variant="outline" className={ROW_BUTTON} disabled={options.length === 0} onClick={() => setOpen(true)}>
        Atribuir
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir responsável</DialogTitle>
          <DialogDescription>{after.description}</DialogDescription>
        </DialogHeader>
        <AgentSelect value={value} onChange={setValue} disabled={busy} options={options} suggestedId={suggestedId} label="Agente" />
        <ErrorLine message={error} />
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button disabled={busy || !value} aria-busy={busy} onClick={confirm}>
            <UserCheck className="size-4" />
            {busy ? "Atribuindo…" : chosen ? `Atribuir a ${chosen.name.split(" ")[0]}` : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Ação da linha da fila do gestor, por etapa (uma só, em contorno):
//   Novo / Em análise / Reavaliação  Analisar (diálogo com resumo e todas as decisões)
//   Autorizado                       Atribuir
//   Não autorizado                   aguardando o solicitante (texto)
//   Atribuído, Em andamento, Em pausa,
//   Aguardando solicitante, Outros,
//   Concluído, Finalizado            Abrir
export function DecisionActions(props: DecisionProps) {
  const { bucket, options, suggestedId, detailHref, ticketId } = props;

  if (bucket === "novo" || bucket === "analise" || bucket === "reavaliacao") return <AnalyzeDialog props={props} />;
  if (bucket === "autorizado") {
    return options.length === 0 ? (
      <p className="text-xs text-muted-foreground">Nenhum agente atende este setor.</p>
    ) : (
      <AssignDialog ticketId={ticketId} options={options} suggestedId={suggestedId} flowStateIds={props.flowStateIds} />
    );
  }
  if (bucket === "nao_autorizado") return <p className="text-xs text-muted-foreground">Aguardando o solicitante reenviar.</p>;
  return (
    <Button asChild variant="outline" className={ROW_BUTTON}>
      <Link href={detailHref}>Abrir</Link>
    </Button>
  );
}
