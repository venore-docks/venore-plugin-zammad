"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@venore/plugin-sdk/ui";
import type { AssigneeOption } from "../../../../features/get-manager-dashboard/types";
import { agentUpdateTicketAction } from "../../../public/actions";

// ALOCAÇÃO RÁPIDA na linha do chamado: escolhe o agente do setor e atribui. Só o gestor/admin vê esta tela e o
// servidor valida de novo (agent-update-ticket: papel + destino atende o setor). Sem agente escolhido, o botão
// fica desligado: nunca atribui por engano.
export function QuickAssign({ ticketId, options, suggestedId }: { ticketId: number; options: AssigneeOption[]; suggestedId: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, startTransition] = useTransition();

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum agente atende o setor deste chamado.</p>;
  }

  function assign() {
    if (!value) return;
    startTransition(async () => {
      const result = await agentUpdateTicketAction({ ticketId, ownerId: Number(value) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Chamado atribuído.");
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={value} onValueChange={setValue} disabled={busy}>
        <SelectTrigger className="h-10 w-full sm:flex-1" aria-label="Atribuir a">
          <SelectValue placeholder="Escolher agente" />
        </SelectTrigger>
        <SelectContent>
          {options.map((person) => (
            <SelectItem key={person.id} value={String(person.id)}>
              {person.name}
              {person.open !== null ? ` · ${person.open} ${person.open === 1 ? "aberto" : "abertos"}` : ""}
              {person.id === suggestedId ? " · sugerido" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button className="h-10 sm:shrink-0" disabled={busy || !value} onClick={assign}>
        <UserCheck className="size-4" />
        {busy ? "Atribuindo…" : "Atribuir"}
      </Button>
    </div>
  );
}
