"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, EmptyState, Input, Textarea } from "@venore/plugin-sdk/ui";
import type { PeopleGroupSummary } from "../../features/manage-people-groups/types";
import { createPeopleGroupAction } from "./actions";

export function CreateGroupDialog({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPeopleGroupAction(name, description);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Grupo “${result.data.name}” criado. Agora adicione as pessoas.`);
      setOpen(false);
      setName("");
      setDescription("");
      router.push(`/admin/colabora/grupos/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus aria-hidden />
          Novo grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo grupo de pessoas</DialogTitle>
            <DialogDescription>Um grupo reúne as pessoas de uma área (ex.: TI, RH). Depois você escolhe quais setores ele pode usar.</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Nome do grupo</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Ex.: Equipe de TI" required autoFocus />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Descrição</span>
            <span className="block text-xs text-muted-foreground">Opcional. Só aparece aqui no admin.</span>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} rows={2} />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Criando…" : "Criar grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GroupEmptyState() {
  return (
    <EmptyState
      icon={<Users className="size-8" strokeWidth={1.5} />}
      title="Crie o primeiro grupo de pessoas"
      description="Crie um grupo por setor — ex.: TI, RH — e libere só os fluxos que fazem sentido para ele. Quem não está no grupo não vê esses setores ao abrir um chamado, mesmo sendo colaborador."
      action={<CreateGroupDialog />}
    />
  );
}

export function GroupList({ groups, sectorNames }: { groups: PeopleGroupSummary[]; sectorNames: Record<string, string> }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const names = group.sectorIds.map((id) => sectorNames[String(id)]).filter(Boolean);
        return (
          <li key={group.id} className="min-w-0">
            <Link
              href={`/admin/colabora/grupos/${group.id}`}
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/40">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base leading-snug font-medium break-words text-foreground">{group.name}</h3>
                      {group.description && <p className="line-clamp-2 text-xs text-muted-foreground">{group.description}</p>}
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </div>
                  <p className="text-2xl font-semibold text-foreground tabular-nums">
                    {group.memberCount}
                    <span className="ms-1.5 text-sm font-normal text-muted-foreground">{group.memberCount === 1 ? "pessoa" : "pessoas"}</span>
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {names.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhum setor liberado ainda</span>
                    ) : (
                      <>
                        {names.slice(0, 3).map((name) => (
                          <Badge key={name} variant="secondary" className="max-w-full">
                            <span className="truncate">{name}</span>
                          </Badge>
                        ))}
                        {names.length > 3 && <Badge variant="outline">+{names.length - 3}</Badge>}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
