"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, Trash2, TriangleAlert, UserMinus, UserPlus } from "lucide-react";
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
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  cn,
} from "@venore/plugin-sdk/ui";
import type { AddByEmailOutcome, Candidate, PeopleGroupDetail, PersonRef } from "../../features/manage-people-groups/types";
import {
  addGroupMembersAction,
  addGroupMembersByEmailAction,
  deletePeopleGroupAction,
  removeGroupMemberAction,
  searchGroupCandidatesAction,
  setGroupSectorsAction,
  updatePeopleGroupAction,
} from "./actions";

export type SectorOption = { groupId: number; name: string; isChild: boolean; audience: string };

function initials(person: PersonRef): string {
  const source = (person.name ?? person.email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

function Avatar({ person }: { person: PersonRef }) {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        initials(person)
      )}
    </span>
  );
}

function PersonLine({ person, trailing }: { person: PersonRef; trailing: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{person.name ?? person.email}</p>
        {person.name && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
      </div>
      {trailing}
    </li>
  );
}

export function GroupEditor({ group, sectors }: { group: PeopleGroupDetail; sectors: SectorOption[] }) {
  return (
    <div className="space-y-6">
      <DetailsCard group={group} />
      <MembersCard group={group} />
      <SectorsCard group={group} sectors={sectors} />
    </div>
  );
}

// --- nome, descrição e exclusão ---

function DetailsCard({ group }: { group: PeopleGroupDetail }) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const dirty = name !== group.name || description !== (group.description ?? "");

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePeopleGroupAction(group.id, name, description);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Grupo salvo.");
      router.refresh();
    });
  }

  function remove() {
    startDelete(async () => {
      const result = await deletePeopleGroupAction(group.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Grupo “${group.name}” excluído.`);
      router.push("/admin/colabora/grupos");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados do grupo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Nome</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Descrição</span>
            <span className="block text-xs text-muted-foreground">Opcional. Só aparece aqui no admin.</span>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} rows={2} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={pending || !dirty || !name.trim()}>
              {pending ? "Salvando…" : "Salvar dados"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={deleting}>
                  <Trash2 aria-hidden />
                  Excluir grupo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir o grupo “{group.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {group.sectorIds.length > 0
                      ? `Ele libera ${group.sectorIds.length} ${group.sectorIds.length === 1 ? "setor" : "setores"}. Setores que dependiam só deste grupo ficam sem ninguém (só administradores os veem). `
                      : ""}
                    As pessoas não são apagadas: só deixam de fazer parte do grupo. Não dá para desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// --- membros ---

function MembersCard({ group }: { group: PeopleGroupDetail }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [cleaning, startCleaning] = useTransition();

  async function remove(person: PersonRef) {
    setRemoving(person.id);
    const result = await removeGroupMemberAction(group.id, person.id);
    setRemoving(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${person.name ?? person.email} saiu do grupo.`);
    router.refresh();
  }

  function cleanMissing() {
    startCleaning(async () => {
      for (const id of group.missingMemberIds) {
        const result = await removeGroupMemberAction(group.id, id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("Contas removidas saíram do grupo.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Membros</CardTitle>
          <p className="text-xs text-muted-foreground">
            {group.memberCount} {group.memberCount === 1 ? "pessoa" : "pessoas"} neste grupo.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <AddMembers group={group} />

        {group.members.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Ninguém por aqui ainda. Busque pelo nome ou cole uma lista de e-mails.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {group.members.map((person) => (
              <PersonLine
                key={person.id}
                person={person}
                trailing={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={removing === person.id}
                    onClick={() => remove(person)}
                    aria-label={`Remover ${person.name ?? person.email} do grupo`}
                  >
                    {removing === person.id ? <Loader2 className="animate-spin" aria-hidden /> : <UserMinus aria-hidden />}
                  </Button>
                }
              />
            ))}
          </ul>
        )}

        {group.missingMemberIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {group.missingMemberIds.length} {group.missingMemberIds.length === 1 ? "conta que não existe mais continua" : "contas que não existem mais continuam"} no grupo.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={cleanMissing} disabled={cleaning}>
              {cleaning ? "Limpando…" : "Limpar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddMembers({ group }: { group: PeopleGroupDetail }) {
  return (
    <Tabs defaultValue="search" className="gap-3">
      <TabsList>
        <TabsTrigger value="search">Buscar pessoas</TabsTrigger>
        <TabsTrigger value="paste">Colar e-mails</TabsTrigger>
      </TabsList>
      <TabsContent value="search">
        <SearchAdd group={group} />
      </TabsContent>
      <TabsContent value="paste">
        <PasteAdd group={group} />
      </TabsContent>
    </Tabs>
  );
}

function SearchAdd({ group }: { group: PeopleGroupDetail }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  // Só a última busca vale (digitação rápida não deixa resposta antiga sobrescrever a nova).
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Busca com espera de 300 ms depois da última tecla (o Zammad não entra aqui, mas o banco agradece).
  function onQueryChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const text = value.trim();
    const ticket = (latest.current += 1);
    if (text.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const result = await searchGroupCandidatesAction(group.id, text);
      if (latest.current !== ticket) return;
      setSearching(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResults(result.data);
    }, 300);
  }

  async function add(person: Candidate) {
    setAdding(person.id);
    const result = await addGroupMembersAction(group.id, [person.id]);
    setAdding(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${person.name ?? person.email} entrou no grupo.`);
    setResults((previous) => previous?.map((entry) => (entry.id === person.id ? { ...entry, alreadyMember: true } : entry)) ?? null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Nome ou e-mail (mínimo 2 letras)"
          aria-label="Buscar pessoas para adicionar"
          className="ps-9"
        />
        {searching && <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {results !== null &&
        (results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém encontrado com esse nome ou e-mail. Só contas aprovadas aparecem.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {results.map((person) => (
              <PersonLine
                key={person.id}
                person={person}
                trailing={
                  person.alreadyMember ? (
                    <Badge variant="secondary">
                      <Check aria-hidden />
                      No grupo
                    </Badge>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled={adding === person.id} onClick={() => add(person)}>
                      <UserPlus aria-hidden />
                      Adicionar
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        ))}
    </div>
  );
}

function PasteAdd({ group }: { group: PeopleGroupDetail }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<AddByEmailOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await addGroupMembersByEmailAction(group.id, text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOutcome(result.data);
      const added = result.data.added.length;
      if (added > 0) {
        toast.success(`${added} ${added === 1 ? "pessoa adicionada" : "pessoas adicionadas"}.`);
        setText("");
      } else toast.message("Ninguém novo para adicionar.");
      router.refresh();
    });
  }

  const problems = outcome ? [...outcome.notFound, ...outcome.invalid] : [];

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-foreground">E-mails</span>
        <span className="block text-xs text-muted-foreground">Um por linha, ou separados por vírgula ou espaço. Só entra quem já tem conta aprovada no portal.</span>
        <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder={"ana@fem.edu.br\nbruno@fem.edu.br"} />
      </label>
      <Button type="button" onClick={submit} disabled={pending || !text.trim()}>
        {pending ? "Adicionando…" : "Adicionar e-mails"}
      </Button>

      {outcome && (
        <div className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite">
          <p className="font-medium text-foreground">
            {outcome.added.length} {outcome.added.length === 1 ? "adicionada" : "adicionadas"}
            {outcome.alreadyMembers.length > 0 && ` · ${outcome.alreadyMembers.length} já estavam no grupo`}
          </p>
          {outcome.truncated && <p className="text-xs text-muted-foreground">Só os primeiros 200 e-mails foram lidos. Cole o restante em outra leva.</p>}
          {problems.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-warning">Não adicionados ({problems.length}): sem conta aprovada no portal ou fora do formato de e-mail.</p>
              <p className="text-xs break-words text-muted-foreground">{problems.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- setores liberados ---

function SectorsCard({ group, sectors }: { group: PeopleGroupDetail; sectors: SectorOption[] }) {
  const router = useRouter();
  const initial = group.sectorIds;
  const [selected, setSelected] = useState<number[]>(initial);
  const [pending, startTransition] = useTransition();
  const dirty = [...selected].sort().join(",") !== [...initial].sort().join(",");
  const becomesRestricted = sectors.filter((sector) => selected.includes(sector.groupId) && !initial.includes(sector.groupId) && sector.audience === "Todos");
  const loseAll = sectors.filter((sector) => !selected.includes(sector.groupId) && initial.includes(sector.groupId));

  function toggle(groupId: number) {
    setSelected((previous) => (previous.includes(groupId) ? previous.filter((id) => id !== groupId) : [...previous, groupId]));
  }

  function save() {
    startTransition(async () => {
      const result = await setGroupSectorsAction(group.id, selected);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Setores liberados atualizados.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Setores liberados</CardTitle>
        <p className="text-xs text-muted-foreground">Marque os setores em que as pessoas deste grupo podem abrir chamados. Um setor marcado deixa de ser aberto a todos e passa a valer só para os grupos escolhidos.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectors.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum setor disponível. Confira a conexão com o Zammad na visão geral.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sectors.map((sector) => {
              const on = selected.includes(sector.groupId);
              return (
                <li key={sector.groupId}>
                  <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", sector.isChild && "ps-6")}>
                    <Switch checked={on} onCheckedChange={() => toggle(sector.groupId)} aria-label={`Liberar ${sector.name} para este grupo`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{sector.name}</span>
                    <Badge variant="outline" className="shrink-0">
                      Hoje: {sector.audience}
                    </Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {becomesRestricted.length > 0 && (
          <p className="flex items-start gap-2 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {becomesRestricted.map((sector) => sector.name).join(", ")} {becomesRestricted.length === 1 ? "era aberto a todos e passará" : "eram abertos a todos e passarão"} a valer só para grupos escolhidos.
          </p>
        )}
        {loseAll.length > 0 && (
          <p className="text-xs text-muted-foreground">Se este grupo era o único liberado em um setor, o setor fica sem ninguém (só administradores o veem) até você liberar outro grupo.</p>
        )}

        <Button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Salvando…" : "Salvar setores liberados"}
        </Button>
      </CardContent>
    </Card>
  );
}
