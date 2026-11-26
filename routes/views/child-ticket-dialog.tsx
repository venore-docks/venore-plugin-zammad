"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitBranchPlus, Loader2 } from "lucide-react";
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
import type { AnswerValue, WizardField } from "../../contracts/types";
import { DESCRIPTION_MAX, TITLE_MAX, validateDescription, validateFields, validateTitle, type Answers } from "../../shared/answers";
import type { ChildMode } from "../../shared/children";
import { createChildTicketAction, getChildFormAction } from "../public/actions";
import { FieldInput } from "../public/field-input";

type Props = {
  parentId: number;
  // Gestor escolhe o agente da subtarefa; o agente cria a subtarefa para si mesmo.
  isSupervisor: boolean;
  assignees: { id: number; name: string }[];
  groups: { id: number; label: string }[];
};

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; fields: WizardField[] };

// "Criar chamado filho": subtarefa no meu setor (já autorizada, com responsável) ou pedido a outro setor (entra
// em Novo na fila do gestor de lá). Quem cria é o solicitante do filho. Os campos do setor de destino vêm do Zammad
// (get-child-form), já preenchidos com o que o chamado pai tem; o servidor revalida tudo ao criar.
export function ChildTicketDialog({ parentId, isSupervisor, assignees, groups }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChildMode>("subtask");
  const [ownerId, setOwnerId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<FormState>({ status: "idle" });
  const [answers, setAnswers] = useState<Answers>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [busy, startTransition] = useTransition();
  const requestRef = useRef(0);

  // Busca os campos do destino (modo + setor). Chamado por quem muda o destino (abrir, trocar o modo, escolher o
  // setor, tentar de novo); respostas atrasadas de um destino anterior são descartadas pelo contador.
  function loadForm(nextMode: ChildMode, nextGroupId: string) {
    const request = (requestRef.current += 1);
    setAnswers({});
    setTouched((current) => new Set([...current].filter((key) => !key.startsWith("field:"))));
    if (nextMode === "sector" && !nextGroupId) {
      setForm({ status: "idle" });
      return;
    }
    setForm({ status: "loading" });
    getChildFormAction({ parentId, mode: nextMode, groupId: nextMode === "sector" ? Number(nextGroupId) : null })
      .then((result) => {
        if (request !== requestRef.current) return;
        if (!result.ok) {
          setForm({ status: "error", message: result.error });
          return;
        }
        setForm({ status: "ready", fields: result.data.fields });
        setAnswers(result.data.defaults);
      })
      .catch(() => {
        if (request === requestRef.current) setForm({ status: "error", message: "Não foi possível carregar os campos do setor." });
      });
  }

  const fields = useMemo(() => (form.status === "ready" ? form.fields : []), [form]);
  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    const titleError = validateTitle(title);
    const descriptionError = validateDescription(description);
    if (titleError) next.title = titleError;
    if (descriptionError) next.description = descriptionError;
    if (mode === "subtask" && isSupervisor && !ownerId) next.owner = "Escolha quem vai fazer a subtarefa.";
    if (mode === "sector" && !groupId) next.group = "Escolha o setor que vai receber.";
    for (const [name, message] of Object.entries(validateFields(fields, answers))) next[`field:${name}`] = message;
    return next;
  }, [title, description, mode, isSupervisor, ownerId, groupId, fields, answers]);
  const invalid = Object.keys(errors).length > 0;
  const shown = (key: string) => (touched.has(key) ? errors[key] : undefined);
  const touch = (key: string) => setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));

  function reset() {
    requestRef.current += 1;
    setMode("subtask");
    setOwnerId("");
    setGroupId("");
    setTitle("");
    setDescription("");
    setForm({ status: "idle" });
    setAnswers({});
    setTouched(new Set());
  }

  function changeMode(next: ChildMode) {
    if (next === mode) return;
    setMode(next);
    loadForm(next, groupId);
  }

  function setAnswer(name: string, value: AnswerValue | null) {
    setAnswers((current) => ({ ...current, [name]: value }));
    touch(`field:${name}`);
  }

  function submit() {
    if (form.status !== "ready" || invalid) return;
    startTransition(async () => {
      const payloadAnswers: Record<string, AnswerValue | null> = {};
      for (const field of fields) payloadAnswers[field.name] = answers[field.name] ?? null;
      const result = await createChildTicketAction({
        parentId,
        mode,
        ownerId: mode === "subtask" && ownerId ? Number(ownerId) : null,
        groupId: mode === "sector" ? Number(groupId) : null,
        title,
        description,
        answers: payloadAnswers,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Chamado filho #${result.data.number} criado.`);
      setOpen(false);
      reset();
      // Dentro da mesma transição: o botão segue ocupado até a tela atualizar (evita o segundo clique).
      startTransition(() => router.refresh());
    });
  }

  const option = (value: ChildMode, label: string, hint: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => changeMode(value)}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-start text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        mode === value ? "border-foreground/50 bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <span className="block">{label}</span>
      <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
    </button>
  );

  const loading = form.status === "loading";
  const blocked = busy || form.status !== "ready" || invalid;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          loadForm(mode, groupId);
        }}
      >
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
              <Select
                value={ownerId}
                onValueChange={(value) => {
                  setOwnerId(value);
                  touch("owner");
                }}
              >
                <SelectTrigger className="h-10 w-full" aria-invalid={Boolean(shown("owner"))}>
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
              {shown("owner") && <span className="block text-xs font-medium text-destructive">{shown("owner")}</span>}
            </label>
          )}

          {mode === "sector" && (
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Setor que vai receber</span>
              <Select
                value={groupId}
                onValueChange={(value) => {
                  setGroupId(value);
                  touch("group");
                  loadForm("sector", value);
                }}
              >
                <SelectTrigger className="h-10 w-full" aria-invalid={Boolean(shown("group"))}>
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
              {shown("group") && <span className="block text-xs font-medium text-destructive">{shown("group")}</span>}
            </label>
          )}

          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Título</span>
            <Input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => touch("title")}
              aria-invalid={Boolean(shown("title"))}
              className="h-10"
            />
            {shown("title") && <span className="block text-xs font-medium text-destructive">{shown("title")}</span>}
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">O que precisa ser feito</span>
            <Textarea
              rows={5}
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => touch("description")}
              aria-invalid={Boolean(shown("description"))}
            />
            {shown("description") && <span className="block text-xs font-medium text-destructive">{shown("description")}</span>}
          </label>

          {loading && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando os campos do setor…
            </p>
          )}

          {form.status === "error" && (
            <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
              <p className="font-medium text-destructive">{form.message}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => loadForm(mode, groupId)}>
                Tentar de novo
              </Button>
            </div>
          )}

          {form.status === "ready" && fields.length > 0 && (
            <fieldset className="space-y-4 border-t pt-4 text-sm">
              <legend className="sr-only">Informações do setor</legend>
              <p className="text-muted-foreground">O que o setor precisa saber. Os campos que este chamado já tinha vêm preenchidos.</p>
              {fields.map((field) => (
                <FieldInput
                  key={field.name}
                  field={field}
                  showLabel
                  value={answers[field.name]}
                  error={shown(`field:${field.name}`)}
                  onChange={(value) => setAnswer(field.name, value)}
                />
              ))}
            </fieldset>
          )}
        </div>

        <DialogFooter className="gap-2">
          {form.status === "ready" && invalid && !busy && (
            <button
              type="button"
              onClick={() => setTouched(new Set(Object.keys(errors)))}
              className="me-auto self-center rounded-sm text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Ver o que falta preencher
            </button>
          )}
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={blocked} onClick={submit}>
            {busy ? "Criando…" : "Criar chamado filho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
