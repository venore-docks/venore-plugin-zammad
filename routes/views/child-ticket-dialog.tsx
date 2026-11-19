"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitBranchPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@venore/plugin-sdk/ui";
import { DESCRIPTION_MAX, TITLE_MAX, validateDescription, validateTitle } from "../../shared/answers";
import type { ChildMode } from "../../shared/children";
import { createChildTicketAction } from "../public/actions";

type Props = {
  parentId: number;
  // Gestor escolhe o agente da subtarefa; o agente cria a subtarefa para si mesmo.
  isSupervisor: boolean;
  assignees: { id: number; name: string }[];
  groups: { id: number; label: string }[];
};

// "Criar chamado filho": subtarefa no meu setor (já autorizada, com responsável) ou pedido a outro setor (entra
// em Novo na fila do gestor de lá). Quem cria é o solicitante do filho.
export function ChildTicketDialog({ parentId, isSupervisor, assignees, groups }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChildMode>("subtask");
  const [ownerId, setOwnerId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, startTransition] = useTransition();

  function reset() {
    setMode("subtask");
    setOwnerId("");
    setGroupId("");
    setTitle("");
    setDescription("");
    setErrors({});
  }

  function submit() {
    const next: Record<string, string> = {};
    const titleError = validateTitle(title);
    const descriptionError = validateDescription(description);
    if (titleError) next.title = titleError;
    if (descriptionError) next.description = descriptionError;
    if (mode === "subtask" && isSupervisor && !ownerId) next.owner = "Escolha quem vai fazer a subtarefa.";
    if (mode === "sector" && !groupId) next.group = "Escolha o setor que vai receber.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    startTransition(async () => {
      const result = await createChildTicketAction({
        parentId,
        mode,
        ownerId: mode === "subtask" && ownerId ? Number(ownerId) : null,
        groupId: mode === "sector" ? Number(groupId) : null,
        title,
        description,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Chamado filho #${result.data.number} criado.`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const option = (value: ChildMode, label: string, hint: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-start text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        mode === value ? "border-foreground/50 bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <span className="block">{label}</span>
      <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <GitBranchPlus className="size-4" />
        Criar chamado filho
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar chamado filho</DialogTitle>
          <DialogDescription>Fica vinculado a este chamado, que só pode ser concluído quando os filhos forem finalizados.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div role="radiogroup" aria-label="Tipo de chamado filho" className="flex flex-col gap-2 sm:flex-row">
            {option("subtask", "Subtarefa no meu setor", isSupervisor ? "Já autorizada, com o agente escolhido." : "Já autorizada, fica com você.")}
            {option("sector", "Pedir a outro setor", "Entra em Novo na fila do gestor de lá.")}
          </div>

          {mode === "subtask" && isSupervisor && (
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Quem vai fazer</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-10 w-full" aria-invalid={Boolean(errors.owner)}>
                  <SelectValue placeholder="Escolher agente" />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.owner && <span className="block text-xs font-medium text-destructive">{errors.owner}</span>}
            </label>
          )}

          {mode === "sector" && (
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Setor que vai receber</span>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="h-10 w-full" aria-invalid={Boolean(errors.group)}>
                  <SelectValue placeholder="Escolher setor" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.group && <span className="block text-xs font-medium text-destructive">{errors.group}</span>}
            </label>
          )}

          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Título</span>
            <Input value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} className="h-10" />
            {errors.title && <span className="block text-xs font-medium text-destructive">{errors.title}</span>}
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">O que precisa ser feito</span>
            <Textarea
              rows={5}
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && <span className="block text-xs font-medium text-destructive">{errors.description}</span>}
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Criando…" : "Criar chamado filho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
