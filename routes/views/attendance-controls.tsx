"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleCheck, Hourglass, PlayCircle } from "lucide-react";
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@venore/plugin-sdk/ui";
import { StaffFlowButtons } from "../public/flow-actions";
import type { AgentControls, AgentStateOption } from "../../contracts/types";
import { localNow } from "../../shared/answers";
import { tomorrowAtNineLocal } from "../../shared/agent-stats";
import { validatePending } from "../../shared/ticket-options";
import { agentUpdateTicketAction } from "../public/actions";

function asOption(state: AgentStateOption) {
  return { id: state.id, name: "", label: state.label, tone: state.tone, needsPending: state.needsPending };
}

// ATENDIMENTO (quem atende o chamado ou o supervisiona), num bloco só. Regra de design:
//   Próximo passo  a dica do fluxo + os botões do passo (1º cheio, demais em contorno). Chamado na fila e
//                  pessoa que aloca: escolher o responsável É o próximo passo (`allocation` vem em destaque).
//   Mais opções    recolhido: realocar, prioridade e estado manual (com data nos "pendente").
// `allocation` é o formulário de alocação (componente de servidor, com a dica do menos carregado), ou null.
export function AttendanceControls({ ticketId, controls, allocation }: { ticketId: number; controls: AgentControls; allocation: React.ReactNode }) {
  const router = useRouter();
  const [stateId, setStateId] = useState(controls.stateId);
  const [priorityId, setPriorityId] = useState(controls.priorityId);
  const [pendingTime, setPendingTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (!controls.canEdit && !allocation) return null;

  const allocationFirst = Boolean(allocation) && controls.ownerId === null;
  const state = controls.states.find((candidate) => candidate.id === stateId);
  const dirty = stateId !== controls.stateId || priorityId !== controls.priorityId;

  // Atalhos: só os que fazem sentido a partir do estado atual.
  const inProgress = controls.states.find((candidate) => candidate.tone === "open");
  const pendingState = controls.states.find((candidate) => candidate.needsPending && /retorno/i.test(candidate.label)) ?? controls.states.find((candidate) => candidate.needsPending);
  const closedState = controls.states.find((candidate) => candidate.tone === "closed");

  function send(update: { stateId?: number; pendingTime?: string; priorityId?: number }, done: string) {
    startTransition(async () => {
      const result = await agentUpdateTicketAction({ ticketId, ...update });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  function save() {
    if (state && stateId !== controls.stateId) {
      const problem = validatePending(asOption(state), pendingTime);
      setError(problem);
      if (problem) return;
    }
    setError(null);
    send(
      {
        stateId: stateId !== controls.stateId ? stateId : undefined,
        pendingTime: state?.needsPending && stateId !== controls.stateId ? pendingTime : undefined,
        priorityId: priorityId !== controls.priorityId ? priorityId : undefined,
      },
      "Alterações salvas.",
    );
  }

  function quickPending() {
    if (!pendingState) return;
    const until = tomorrowAtNineLocal();
    const problem = validatePending(asOption(pendingState), until);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    send({ stateId: pendingState.id, pendingTime: until }, "Chamado pendente até amanhã, 9h.");
  }

  // No fluxo da FEM os atalhos são os botões do fluxo; os genéricos ficam de fora.
  const showInProgress = controls.canEdit && !controls.inFlow && inProgress && inProgress.id !== controls.stateId;
  const showPending = controls.canEdit && !controls.inFlow && pendingState && pendingState.id !== controls.stateId;
  const showClose = controls.canEdit && !controls.inFlow && closedState && closedState.id !== controls.stateId;
  const hasQuick = showInProgress || showPending || showClose;
  const hasFlow = controls.canEdit && controls.flowActions.length > 0;
  // Só o estado atual na lista = nada a mudar por aqui (o seletor some; fica a prioridade).
  const canChangeState = controls.states.some((option) => option.id !== controls.stateId);
  const hasNextStep = allocationFirst || hasFlow || hasQuick || Boolean(controls.flowHint);

  return (
    <section className="@container space-y-4 rounded-lg border bg-card p-4 @md:p-5" aria-label="Atendimento">
      {hasNextStep && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Próximo passo</h3>
          {controls.flowHint && <p className="text-sm text-muted-foreground">{controls.flowHint}</p>}
        </div>
      )}

      {allocationFirst && allocation}

      {hasFlow && <StaffFlowButtons ticketId={ticketId} actions={controls.flowActions} disabled={busy} />}

      {hasQuick && (
        <div className="grid gap-2 @md:flex @md:flex-wrap">
          {showInProgress && (
            <Button type="button" variant="outline" className="h-10 justify-start @md:justify-center" disabled={busy} onClick={() => send({ stateId: inProgress.id }, "Chamado em andamento.")}>
              <PlayCircle className="size-4" />
              Marcar em andamento
            </Button>
          )}
          {showPending && (
            <Button type="button" variant="outline" className="h-10 justify-start @md:justify-center" disabled={busy} onClick={quickPending}>
              <Hourglass className="size-4" />
              Pendente até amanhã 9h
            </Button>
          )}
          {showClose && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="h-10 justify-start @md:justify-center" disabled={busy}>
                  <CircleCheck className="size-4" />
                  Encerrar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar este chamado?</AlertDialogTitle>
                  <AlertDialogDescription>O solicitante será avisado de que o assunto foi resolvido. Você pode reabrir depois, se precisar.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Ainda não</AlertDialogCancel>
                  <AlertDialogAction onClick={() => send({ stateId: closedState.id }, "Chamado encerrado.")}>Sim, encerrar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {(controls.canEdit || (allocation && !allocationFirst)) && (
        <details className={hasNextStep ? "group border-t pt-3" : "group"}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden />
            Mais opções
          </summary>
          <div className="mt-4 space-y-4">
            {!allocationFirst && allocation}
            {controls.canEdit && (
              <>
                <div className="grid gap-3 @md:grid-cols-2">
                  <label className="space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Prioridade</span>
                    <Select value={String(priorityId)} onValueChange={(value) => setPriorityId(Number(value))}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {controls.priorities.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  {canChangeState && (
                    <label className="space-y-1.5 text-sm">
                      <span className="text-muted-foreground">Mudar estado manualmente</span>
                      <Select value={String(stateId)} onValueChange={(value) => setStateId(Number(value))}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {controls.states.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                </div>

                {state?.needsPending && stateId !== controls.stateId && (
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Até quando? (o chamado volta a aparecer nessa data)</span>
                    <Input type="datetime-local" className="h-10" min={localNow()} value={pendingTime} onChange={(event) => setPendingTime(event.target.value)} />
                  </label>
                )}

                {dirty && (
                  <Button variant="outline" className="h-10 w-full @md:w-auto" disabled={busy} onClick={save}>
                    {busy ? "Salvando…" : "Salvar alterações"}
                  </Button>
                )}
              </>
            )}
          </div>
        </details>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
