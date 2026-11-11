"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandHelping, Undo2 } from "lucide-react";
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
import type { AgentControls as Controls } from "../../contracts/types";
import type { AgentUpdateInput } from "../../index";
import { localNow } from "../../shared/answers";
import { validatePending } from "../../shared/ticket-options";
import { agentUpdateTicketAction } from "../public/actions";

// Controles de atendimento do agente: assumir (fila), mudar estado/prioridade e devolver à fila.
// Estado e prioridade só com o chamado na mão dele (`canWork`); na fila só existe "Assumir".
export function AgentControls({ ticketId, controls, unassigned }: { ticketId: number; controls: Controls; unassigned: boolean }) {
  const router = useRouter();
  const [stateId, setStateId] = useState(controls.stateId);
  const [priorityId, setPriorityId] = useState(controls.priorityId);
  const [pendingTime, setPendingTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const state = controls.states.find((candidate) => candidate.id === stateId);
  const dirty = stateId !== controls.stateId || priorityId !== controls.priorityId;

  function run(change: Omit<AgentUpdateInput, "ticketId">, success: string) {
    startTransition(async () => {
      const result = await agentUpdateTicketAction({ ticketId, ...change });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function save() {
    if (state && stateId !== controls.stateId) {
      const problem = validatePending({ id: state.id, name: "", label: state.label, tone: state.tone, needsPending: state.needsPending }, pendingTime);
      setError(problem);
      if (problem) return;
    }
    setError(null);
    run(
      {
        stateId: stateId !== controls.stateId ? stateId : undefined,
        pendingTime: state?.needsPending ? pendingTime : undefined,
        priorityId: priorityId !== controls.priorityId ? priorityId : undefined,
      },
      "Alterações salvas.",
    );
  }

  if (!controls.canWork) {
    return (
      <div className="space-y-3 rounded-xl border border-warning-border bg-warning-soft p-4">
        <p className="text-sm text-foreground">
          {unassigned ? "Este chamado está na fila, sem responsável." : "Este chamado não está com você."}
        </p>
        <Button className="w-full" size="lg" disabled={busy} onClick={() => run({ owner: "me" }, "Chamado assumido.")}>
          <HandHelping className="size-4" />
          {busy ? "Assumindo…" : "Assumir chamado"}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Atendimento">
      <h3 className="text-sm font-semibold text-foreground">Atendimento</h3>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button disabled={!dirty || busy} onClick={save}>
          {busy ? "Salvando…" : "Salvar alterações"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              <Undo2 className="size-3.5" />
              Devolver à fila
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Devolver este chamado à fila?</AlertDialogTitle>
              <AlertDialogDescription>Ele deixa de estar com você e qualquer agente do setor poderá assumi-lo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => run({ owner: "release" }, "Chamado devolvido à fila.")}>Devolver</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
