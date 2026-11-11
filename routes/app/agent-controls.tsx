"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@venore/plugin-sdk/ui";
import type { AgentControls as Controls } from "../../contracts/types";
import type { AgentUpdateInput } from "../../index";
import { localNow } from "../../shared/answers";
import { validatePending } from "../../shared/ticket-options";
import { agentUpdateTicketAction } from "../public/actions";

// Controles de quem atende ou supervisiona o chamado.
//   Responsável (gestor/admin): atribui a um agente do setor, realoca ou devolve à fila. O agente comum
//     NUNCA vê isto: quem aloca é o gestor.
//   Atendimento (quem atende o chamado ou o supervisiona): estado (com data nos "pendente") e prioridade.
const NO_OWNER = "0";

export function AgentControls({ ticketId, controls }: { ticketId: number; controls: Controls }) {
  const router = useRouter();
  const [stateId, setStateId] = useState(controls.stateId);
  const [priorityId, setPriorityId] = useState(controls.priorityId);
  const [pendingTime, setPendingTime] = useState("");
  const [ownerValue, setOwnerValue] = useState(controls.ownerId === null ? NO_OWNER : String(controls.ownerId));
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const state = controls.states.find((candidate) => candidate.id === stateId);
  const dirty = stateId !== controls.stateId || priorityId !== controls.priorityId;
  const currentOwner = controls.ownerId === null ? NO_OWNER : String(controls.ownerId);
  const unassigned = controls.ownerId === null;

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

  function saveWork() {
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

  if (!controls.canAllocate && !controls.canEdit) return null;

  return (
    <div className="space-y-4">
      {controls.canAllocate && (
        <section
          className={unassigned ? "space-y-3 rounded-xl border border-warning-border bg-warning-soft p-4" : "space-y-3 rounded-xl border bg-card p-4"}
          aria-label="Responsável"
        >
          <h3 className="text-sm font-semibold text-foreground">Responsável</h3>
          {unassigned && <p className="text-sm text-foreground">Este chamado está na fila. Escolha quem vai atendê-lo.</p>}
          {controls.assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agente do Zammad atende o setor deste chamado.</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={ownerValue} onValueChange={setOwnerValue}>
                <SelectTrigger className="h-11 w-full sm:flex-1" aria-label="Responsável pelo chamado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OWNER}>Ninguém (na fila)</SelectItem>
                  {controls.assignees.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="lg"
                disabled={busy || ownerValue === currentOwner}
                onClick={() => run({ ownerId: ownerValue === NO_OWNER ? null : Number(ownerValue) }, ownerValue === NO_OWNER ? "Chamado devolvido à fila." : "Chamado atribuído.")}
              >
                <UserCheck className="size-4" />
                {busy ? "Salvando…" : ownerValue === NO_OWNER ? "Devolver à fila" : unassigned ? "Atribuir" : "Realocar"}
              </Button>
            </div>
          )}
        </section>
      )}

      {controls.canEdit && (
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

          <Button disabled={!dirty || busy} onClick={saveWork}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </Button>
        </section>
      )}
    </div>
  );
}
