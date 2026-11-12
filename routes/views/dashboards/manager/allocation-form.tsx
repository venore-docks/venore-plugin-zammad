"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@venore/plugin-sdk/ui";
import type { AgentControls } from "../../../../contracts/types";
import { agentUpdateTicketAction } from "../../../public/actions";

// Formulário de ALOCAÇÃO (gestor/admin) no detalhe do chamado: quem atende agora em destaque, escolha do novo
// responsável e confirmação ao devolver à fila. Quem aloca é o gestor — o servidor aplica a regra de novo.
// `children` é a dica do menos carregado (renderizada no servidor, em Suspense, para não atrasar a página).
const NO_OWNER = "0";

export function AllocationForm({ ticketId, controls, children }: { ticketId: number; controls: AgentControls; children?: React.ReactNode }) {
  const router = useRouter();
  const [ownerValue, setOwnerValue] = useState(controls.ownerId === null ? NO_OWNER : String(controls.ownerId));
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [busy, startTransition] = useTransition();

  const currentOwner = controls.ownerId === null ? NO_OWNER : String(controls.ownerId);
  const unassigned = controls.ownerId === null;
  const ownerName = unassigned ? null : (controls.assignees.find((person) => person.id === controls.ownerId)?.name ?? "Outra pessoa");
  const returning = ownerValue === NO_OWNER;
  const unchanged = ownerValue === currentOwner;

  function choose(value: string) {
    setOwnerValue(value);
    setConfirmingReturn(false);
  }

  function allocate() {
    startTransition(async () => {
      const ownerId = returning ? null : Number(ownerValue);
      const result = await agentUpdateTicketAction({ ticketId, ownerId });
      setConfirmingReturn(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(ownerId === null ? "Chamado devolvido à fila." : "Chamado atribuído.");
      router.refresh();
    });
  }

  function submit() {
    // Devolver à fila tira o chamado de quem o atende: pede confirmação antes.
    if (returning && !unassigned && !confirmingReturn) {
      setConfirmingReturn(true);
      return;
    }
    allocate();
  }

  return (
    <section
      className={cn("space-y-4 rounded-xl border p-4 sm:p-5", unassigned ? "border-warning-border bg-warning-soft" : "bg-card")}
      aria-label="Responsável"
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", unassigned ? "bg-warning/20 text-foreground" : "bg-primary/10 text-primary")}>
          <UserRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Responsável</p>
          <p className="truncate text-base font-semibold text-foreground">{ownerName ?? "Ninguém — na fila"}</p>
        </div>
      </div>

      {unassigned && <p className="text-sm text-foreground">Este chamado está na fila. Escolha quem vai atendê-lo.</p>}

      {controls.assignees.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum agente do Zammad atende o setor deste chamado.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={ownerValue} onValueChange={choose} disabled={busy}>
              <SelectTrigger className="h-11 w-full sm:flex-1" aria-label="Novo responsável pelo chamado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OWNER}>Ninguém (devolver à fila)</SelectItem>
                {controls.assignees.map((person) => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name}
                    {person.id === controls.ownerId ? " · atual" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!confirmingReturn && (
              <Button size="lg" disabled={busy || unchanged} onClick={submit}>
                <UserCheck className="size-4" />
                {busy ? "Salvando…" : returning ? "Devolver à fila" : unassigned ? "Atribuir" : "Realocar"}
              </Button>
            )}
          </div>

          {confirmingReturn && (
            <div className="space-y-3 rounded-lg border border-warning-border bg-warning-soft p-3" role="alertdialog" aria-label="Confirmar devolução à fila">
              <p className="text-sm text-foreground">
                Devolver à fila? {ownerName} deixa de ser responsável e o chamado fica sem ninguém até você alocá-lo de novo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={allocate}>
                  {busy ? "Salvando…" : "Sim, devolver"}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirmingReturn(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {children}
        </div>
      )}
    </section>
  );
}
