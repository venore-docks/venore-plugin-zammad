"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@venore/plugin-sdk/ui";
import type { AgentControls } from "../../contracts/types";
import { localNow } from "../../shared/answers";
import { validatePending } from "../../shared/ticket-options";
import { agentUpdateTicketAction } from "../public/actions";

// ATENDIMENTO (quem atende o chamado ou o supervisiona): estado (com data nos "pendente") e prioridade.
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

  function save() {
    if (state && stateId !== controls.stateId) {
      const problem = validatePending({ id: state.id, name: "", label: state.label, tone: state.tone, needsPending: state.needsPending }, pendingTime);
      setError(problem);
      if (problem) return;
    }
    setError(null);
    startTransition(async () => {
      const result = await agentUpdateTicketAction({
        ticketId,
        stateId: stateId !== controls.stateId ? stateId : undefined,
        pendingTime: state?.needsPending ? pendingTime : undefined,
        priorityId: priorityId !== controls.priorityId ? priorityId : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Alterações salvas.");
      router.refresh();
    });
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

      <Button disabled={!dirty || busy} onClick={save}>
        {busy ? "Salvando…" : "Salvar alterações"}
      </Button>
    </section>
  );
}
