"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Hourglass, PlayCircle } from "lucide-react";
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
import type { AgentControls, AgentStateOption } from "../../contracts/types";
import { localNow } from "../../shared/answers";
import { tomorrowAtNineLocal } from "../../shared/agent-stats";
import { validatePending } from "../../shared/ticket-options";
import { agentUpdateTicketAction } from "../public/actions";

function asOption(state: AgentStateOption) {
  return { id: state.id, name: "", label: state.label, tone: state.tone, needsPending: state.needsPending };
}

// ATENDIMENTO (quem atende o chamado ou o supervisiona): ações rápidas + estado (com data nos "pendente") e prioridade.
export function AttendanceControls({ ticketId, controls }: { ticketId: number; controls: AgentControls }) {
  const router = useRouter();
  const [stateId, setStateId] = useState(controls.stateId);
  const [priorityId, setPriorityId] = useState(controls.priorityId);
  const [pendingTime, setPendingTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (!controls.canEdit) return null;

  const state = controls.states.find((candidate) => candidate.id === stateId);
  const dirty = stateId !== controls.stateId || priorityId !== controls.priorityId;

  // Atalhos: só os que fazem sentido a partir do estado atual.
  const current = controls.states.find((candidate) => candidate.id === controls.stateId);
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

  const showInProgress = inProgress && inProgress.id !== controls.stateId;
  const showPending = pendingState && pendingState.id !== controls.stateId;
  const showClose = closedState && closedState.id !== controls.stateId;
  const hasQuick = showInProgress || showPending || showClose;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label="Atendimento">
      <h3 className="text-sm font-semibold text-foreground">Atendimento</h3>

      {hasQuick && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Ações rápidas</p>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {showInProgress && (
              <Button type="button" variant="outline" className="h-11 justify-start sm:justify-center" disabled={busy} onClick={() => send({ stateId: inProgress.id }, "Chamado em andamento.")}>
                <PlayCircle className="size-4" />
                Marcar em andamento
              </Button>
            )}
            {showPending && (
              <Button type="button" variant="outline" className="h-11 justify-start sm:justify-center" disabled={busy} onClick={quickPending}>
                <Hourglass className="size-4" />
                Pendente até amanhã 9h
              </Button>
            )}
            {showClose && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 justify-start sm:justify-center" disabled={busy}>
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
          {current && <p className="text-xs text-muted-foreground">Estado atual: {current.label}.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Estado</span>
          <Select value={String(stateId)} onValueChange={(value) => setStateId(Number(value))}>
            <SelectTrigger className="h-11 w-full">
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
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Prioridade</span>
          <Select value={String(priorityId)} onValueChange={(value) => setPriorityId(Number(value))}>
            <SelectTrigger className="h-11 w-full">
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
      </div>

      {state?.needsPending && stateId !== controls.stateId && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Até quando? (o chamado volta a aparecer nessa data)</span>
          <Input type="datetime-local" className="h-11" min={localNow()} value={pendingTime} onChange={(event) => setPendingTime(event.target.value)} />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button className="h-11 w-full sm:w-auto" disabled={!dirty || busy} onClick={save}>
        {busy ? "Salvando…" : "Salvar alterações"}
      </Button>
    </section>
  );
}
