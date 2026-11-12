"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@venore/plugin-sdk/ui";
import type { AgentControls } from "../../contracts/types";
import { agentUpdateTicketAction } from "../public/actions";

// ALOCAÇÃO (gestor/admin): atribuir o chamado a um agente do setor, realocar ou devolver à fila. O agente comum
// NUNCA vê isto — quem aloca é o gestor (a regra também é aplicada no servidor, em agent-update-ticket).
const NO_OWNER = "0";

export function AllocationControls({ ticketId, controls }: { ticketId: number; controls: AgentControls }) {
  const router = useRouter();
  const [ownerValue, setOwnerValue] = useState(controls.ownerId === null ? NO_OWNER : String(controls.ownerId));
  const [busy, startTransition] = useTransition();

  if (!controls.canAllocate) return null;

  const currentOwner = controls.ownerId === null ? NO_OWNER : String(controls.ownerId);
  const unassigned = controls.ownerId === null;

  function allocate() {
    startTransition(async () => {
      const ownerId = ownerValue === NO_OWNER ? null : Number(ownerValue);
      const result = await agentUpdateTicketAction({ ticketId, ownerId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(ownerId === null ? "Chamado devolvido à fila." : "Chamado atribuído.");
      router.refresh();
    });
  }

  return (
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
          <Button size="lg" disabled={busy || ownerValue === currentOwner} onClick={allocate}>
            <UserCheck className="size-4" />
            {busy ? "Salvando…" : ownerValue === NO_OWNER ? "Devolver à fila" : unassigned ? "Atribuir" : "Realocar"}
          </Button>
        </div>
      )}
    </section>
  );
}
