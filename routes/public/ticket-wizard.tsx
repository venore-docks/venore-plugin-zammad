"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleCheck, ExternalLink, Paperclip, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@venore/plugin-sdk/ui";
import type { AnswerValue, CreatedTicket, SectorForm, WizardData, WizardField, WizardStep } from "../../contracts/types";
import {
  DESCRIPTION_MIN,
  TITLE_MAX,
  displayAnswer,
  formatBytes,
  isEmptyAnswer,
  localNow,
  validateAttachments,
  validateDescription,
  validateFields,
  validateTitle,
  type Answers,
} from "../../shared/answers";
import { createTicketAction } from "./actions";

type StepDef =
  | { kind: "sector"; title: string }
  | { kind: "fields"; title: string; step: WizardStep }
  | { kind: "description"; title: string }
  | { kind: "title"; title: string }
  | { kind: "review"; title: string };

const DEFAULT_INTRO =
  "Responda algumas perguntas rápidas. Assim o chamado chega no setor certo, com tudo o que a equipe precisa para resolver mais rápido.";
const DEFAULT_BODY_HINTS = [
  "O que você precisa ou o que aconteceu?",
  "Onde? (sala, prédio, sistema, equipamento)",
  "Desde quando, ou para quando precisa?",
  "Já tentou alguma coisa? Qual foi o resultado?",
];
// Selects com poucas opções viram botões (um toque); com muitas, lista suspensa.
const MAX_INLINE_OPTIONS = 6;

function initialAnswers(sector: SectorForm | undefined): Answers {
  const answers: Answers = {};
  for (const step of sector?.steps ?? []) {
    for (const field of step.fields) answers[field.name] = field.defaultValue;
  }
  return answers;
}

function suggestTitle(sector: SectorForm | undefined, description: string): string {
  const firstLine = description.trim().split(/[\n.!?]/)[0]?.trim() ?? "";
  const base = firstLine.length > 80 ? `${firstLine.slice(0, 77).trimEnd()}…` : firstLine;
  if (!base) return sector?.label ?? "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function TicketWizard({ data, initialGroupId }: { data: WizardData; initialGroupId: number | null }) {
  const sectors = data.sectors;
  const byId = useMemo(() => new Map(sectors.map((sector) => [sector.groupId, sector])), [sectors]);
  const initialSector = initialGroupId ? byId.get(initialGroupId) : undefined;

  const [groupId, setGroupId] = useState<number | null>(initialSector?.groupId ?? null);
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(initialSector));
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [index, setIndex] = useState(initialSector ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedTicket | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const sector = groupId ? byId.get(groupId) : undefined;
  const steps: StepDef[] = useMemo(
    () => [
      { kind: "sector", title: "Para qual setor é o seu pedido?" },
      ...(sector?.steps ?? []).map((step): StepDef => ({ kind: "fields", title: step.title, step })),
      { kind: "description", title: "Conte o que você precisa" },
      { kind: "title", title: "Dê um título ao chamado" },
      { kind: "review", title: "Confira antes de enviar" },
    ],
    [sector],
  );
  const current = steps[Math.min(index, steps.length - 1)];
  const progress = Math.round(((index + 1) / steps.length) * 100);

  function goTo(next: number) {
    setErrors({});
    setIndex(next);
    if (steps[next]?.kind === "title" && title.trim().length === 0) setTitle(suggestTitle(sector, description));
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function chooseSector(id: number) {
    if (id === groupId) return;
    setGroupId(id);
    setAnswers(initialAnswers(byId.get(id)));
    setErrors({});
  }

  function validateCurrent(): boolean {
    let next: Record<string, string> = {};
    if (current.kind === "sector" && !sector) next = { sector: "Escolha o setor para continuar." };
    if (current.kind === "fields") next = validateFields(current.step.fields, answers);
    if (current.kind === "description") {
      const descriptionError = validateDescription(description);
      const attachmentError = validateAttachments(files, data.limits);
      if (descriptionError) next.description = descriptionError;
      if (attachmentError) next.attachments = attachmentError;
    }
    if (current.kind === "title") {
      const titleError = validateTitle(title);
      if (titleError) next.title = titleError;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext(event?: React.FormEvent) {
    event?.preventDefault();
    if (current.kind === "review") return submit();
    if (validateCurrent()) goTo(index + 1);
  }

  function submit() {
    if (!sector) return;
    const formData = new FormData();
    formData.set("payload", JSON.stringify({ groupId: sector.groupId, title, description, answers }));
    files.forEach((file) => formData.append("attachments", file));
    startTransition(async () => {
      const result = await createTicketAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreated(result.data);
    });
  }

  function restart() {
    setCreated(null);
    setGroupId(null);
    setAnswers({});
    setDescription("");
    setTitle("");
    setFiles([]);
    setErrors({});
    setIndex(0);
  }

  if (created) return <CreatedScreen ticket={created} onRestart={restart} />;

  if (sectors.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum setor está recebendo chamados por aqui no momento.
      </div>
    );
  }

  return (
    <form onSubmit={handleNext} className="space-y-6" noValidate>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Etapa {index + 1} de {steps.length}
          </span>
          {sector && current.kind !== "sector" && <span className="truncate">{sector.label}</span>}
        </div>
        <Progress value={progress} />
      </div>

      <section className="space-y-6 rounded-xl border bg-card p-6 sm:p-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-foreground outline-none sm:text-2xl">
          {current.title}
        </h2>

        {current.kind === "sector" && (
          <SectorStep
            intro={data.intro ?? DEFAULT_INTRO}
            sectors={sectors}
            selectedId={groupId}
            onSelect={chooseSector}
            error={errors.sector}
          />
        )}

        {current.kind === "fields" && (
          <div className="space-y-8">
            {current.step.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                showLabel={current.step.fields.length > 1}
                value={answers[field.name]}
                error={errors[field.name]}
                onChange={(value) => setAnswers((prev) => ({ ...prev, [field.name]: value }))}
              />
            ))}
          </div>
        )}

        {current.kind === "description" && (
          <DescriptionStep
            hint={sector?.bodyHint ?? null}
            description={description}
            onDescription={setDescription}
            files={files}
            onFiles={setFiles}
            limits={data.limits}
            errors={errors}
          />
        )}

        {current.kind === "title" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Um bom título diz <strong className="text-foreground">o quê</strong> e <strong className="text-foreground">onde</strong>. Ex.: “Projetor
              da sala 204 não liga”, “Banner para a Feira de Ciências”.
            </p>
            <Input
              autoFocus
              value={title}
              maxLength={TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={Boolean(errors.title)}
              className="h-11 text-base"
            />
            {title.trim() !== suggestTitle(sector, description) && description.trim().length > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => setTitle(suggestTitle(sector, description))}
              >
                <Sparkles className="size-3.5" />
                Usar sugestão: “{suggestTitle(sector, description)}”
              </button>
            )}
            <FieldError message={errors.title} />
          </div>
        )}

        {current.kind === "review" && sector && (
          <ReviewStep sector={sector} answers={answers} description={description} title={title} files={files} steps={steps} onEdit={goTo} />
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        {index > 0 ? (
          <Button type="button" variant="ghost" onClick={() => goTo(index - 1)} disabled={pending}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        ) : (
          <Button type="button" variant="ghost" asChild>
            <Link href="/chamados">Cancelar</Link>
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending} className="min-w-36">
          {current.kind === "review" ? (
            <>
              <Check className="size-4" />
              {pending ? "Enviando…" : "Enviar chamado"}
            </>
          ) : (
            <>
              Continuar
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function SectorStep({
  intro,
  sectors,
  selectedId,
  onSelect,
  error,
}: {
  intro: string;
  sectors: SectorForm[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  error?: string;
}) {
  const ids = new Set(sectors.map((sector) => sector.groupId));
  const topLevel = sectors.filter((sector) => sector.parentId === null || !ids.has(sector.parentId));
  const childrenOf = (id: number) => sectors.filter((sector) => sector.parentId === id);
  const selected = sectors.find((sector) => sector.groupId === selectedId);
  // Pai "aberto": o escolhido, ou o pai do subgrupo escolhido.
  const openParentId = selected ? (selected.parentId !== null && ids.has(selected.parentId) ? selected.parentId : selected.groupId) : null;
  const subOptions = openParentId !== null ? childrenOf(openParentId) : [];
  const parent = openParentId !== null ? sectors.find((sector) => sector.groupId === openParentId) : undefined;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {topLevel.map((sector) => {
          const active = openParentId === sector.groupId;
          const hasChildren = childrenOf(sector.groupId).length > 0;
          return (
            <button
              key={sector.groupId}
              type="button"
              onClick={() => onSelect(sector.groupId)}
              aria-pressed={active}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active && "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              <span className="space-y-1">
                <span className="block font-medium text-foreground">{sector.label}</span>
                {sector.description && <span className="block text-xs text-muted-foreground">{sector.description}</span>}
              </span>
              {hasChildren ? (
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                active && <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {parent && subOptions.length > 0 && (
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium text-foreground">Qual assunto de {parent.label}?</p>
          <div className="flex flex-wrap gap-2">
            {[parent, ...subOptions].map((option) => (
              <OptionChip key={option.groupId} selected={selectedId === option.groupId} onClick={() => onSelect(option.groupId)}>
                {option.groupId === parent.groupId ? "Outro assunto / geral" : option.label}
              </OptionChip>
            ))}
          </div>
        </div>
      )}
      <FieldError message={error} />
    </div>
  );
}

function OptionChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground",
      )}
    >
      {selected && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

function FieldInput({
  field,
  showLabel,
  value,
  error,
  onChange,
}: {
  field: WizardField;
  showLabel: boolean;
  value: AnswerValue | null | undefined;
  error?: string;
  onChange: (value: AnswerValue | null) => void;
}) {
  const id = `field-${field.name}`;
  const nowLocal = localNow();
  return (
    <div className="space-y-3">
      {showLabel && (
        <label htmlFor={id} className="block font-medium text-foreground">
          {field.label}
          {!field.required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>}
        </label>
      )}
      {!showLabel && !field.required && <p className="text-xs text-muted-foreground">Opcional — pode pular se não se aplicar.</p>}
      {field.help && <p className="text-sm text-muted-foreground">{field.help}</p>}

      {field.type === "select" &&
        (field.options.length <= MAX_INLINE_OPTIONS ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={id}>
            {field.options.map((option) => (
              <OptionChip
                key={option.value}
                selected={value === option.value}
                onClick={() => onChange(value === option.value && !field.required ? null : option.value)}
              >
                {option.label}
              </OptionChip>
            ))}
          </div>
        ) : (
          <Select value={typeof value === "string" ? value : ""} onValueChange={(next) => onChange(next || null)}>
            <SelectTrigger id={id} className="h-11 w-full sm:w-96" aria-invalid={Boolean(error)}>
              <SelectValue placeholder="Escolha uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

      {field.type === "multiselect" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Pode marcar mais de uma.</p>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => {
              const list = Array.isArray(value) ? value : [];
              const selected = list.includes(option.value);
              return (
                <OptionChip
                  key={option.value}
                  selected={selected}
                  onClick={() => onChange(selected ? list.filter((item) => item !== option.value) : [...list, option.value])}
                >
                  {option.label}
                </OptionChip>
              );
            })}
          </div>
        </div>
      )}

      {field.type === "boolean" && (
        <div className="flex gap-3">
          {field.options.map((option) => {
            const optionValue = option.value === "true";
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(optionValue)}
                aria-pressed={value === optionValue}
                className={cn(
                  "min-w-28 rounded-lg border px-5 py-3 text-sm font-medium capitalize transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  value === optionValue ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {field.type === "date" && (
        <Input
          id={id}
          type="date"
          className="h-11 w-full sm:w-60"
          value={typeof value === "string" ? value : ""}
          min={field.allowPast ? undefined : nowLocal.slice(0, 10)}
          max={field.allowFuture ? undefined : nowLocal.slice(0, 10)}
          onChange={(event) => onChange(event.target.value || null)}
          aria-invalid={Boolean(error)}
        />
      )}

      {field.type === "datetime" && (
        <Input
          id={id}
          type="datetime-local"
          className="h-11 w-full sm:w-72"
          value={typeof value === "string" ? value : ""}
          min={field.allowPast ? undefined : nowLocal}
          max={field.allowFuture ? undefined : nowLocal}
          onChange={(event) => onChange(event.target.value || null)}
          aria-invalid={Boolean(error)}
        />
      )}

      {field.type === "text" && (
        <Input
          id={id}
          className="h-11"
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength ?? undefined}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          id={id}
          rows={4}
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength ?? undefined}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
        />
      )}

      {field.type === "integer" && (
        <Input
          id={id}
          type="number"
          step={1}
          className="h-11 w-40"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
          aria-invalid={Boolean(error)}
        />
      )}

      <FieldError message={error} />
    </div>
  );
}

function DescriptionStep({
  hint,
  description,
  onDescription,
  files,
  onFiles,
  limits,
  errors,
}: {
  hint: string | null;
  description: string;
  onDescription: (value: string) => void;
  files: File[];
  onFiles: (files: File[]) => void;
  limits: WizardData["limits"];
  errors: Record<string, string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hints = hint ? hint.split("\n").filter((line) => line.trim().length > 0) : DEFAULT_BODY_HINTS;
  const remaining = Math.max(0, DESCRIPTION_MIN - description.trim().length);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/60 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Ajuda a equipe se você contar:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {hints.map((line) => (
            <li key={line}>{line.replace(/^[-•*]\s*/, "")}</li>
          ))}
        </ul>
      </div>
      <Textarea
        autoFocus
        rows={8}
        value={description}
        onChange={(event) => onDescription(event.target.value)}
        placeholder="Escreva aqui com suas palavras…"
        aria-invalid={Boolean(errors.description)}
        className="text-base"
      />
      {remaining > 0 && description.length > 0 && <p className="text-xs text-muted-foreground">Mais {remaining} caracteres, pelo menos.</p>}
      <FieldError message={errors.description} />

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            const added = Array.from(event.target.files ?? []);
            onFiles([...files, ...added]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={files.length >= limits.maxFiles}>
          <Paperclip className="size-4" />
          Anexar arquivo ou foto
        </Button>
        <p className="text-xs text-muted-foreground">
          Opcional. Até {limits.maxFiles} arquivos, {formatBytes(limits.maxTotalBytes)} no total — prints, fotos e referências ajudam muito.
        </p>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file, position) => (
              <li key={`${file.name}-${position}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="truncate text-foreground">{file.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                  <button
                    type="button"
                    aria-label={`Remover ${file.name}`}
                    className="rounded p-1 hover:bg-muted"
                    onClick={() => onFiles(files.filter((_, other) => other !== position))}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <FieldError message={errors.attachments} />
      </div>
    </div>
  );
}

function ReviewStep({
  sector,
  answers,
  description,
  title,
  files,
  steps,
  onEdit,
}: {
  sector: SectorForm;
  answers: Answers;
  description: string;
  title: string;
  files: File[];
  steps: StepDef[];
  onEdit: (index: number) => void;
}) {
  const indexOf = (predicate: (step: StepDef) => boolean) => steps.findIndex(predicate);
  const rows: { label: string; value: string; stepIndex: number }[] = [
    { label: "Título", value: title.trim(), stepIndex: indexOf((step) => step.kind === "title") },
    { label: "Setor", value: sector.label, stepIndex: 0 },
    ...sector.steps.flatMap((step) =>
      step.fields
        .filter((field) => field.required || !isEmptyAnswer(answers[field.name]))
        .map((field) => ({
          label: field.label,
          value: displayAnswer(field, answers[field.name]),
          stepIndex: indexOf((candidate) => candidate.kind === "fields" && candidate.step.key === step.key),
        })),
    ),
  ];
  const descriptionIndex = indexOf((step) => step.kind === "description");

  return (
    <div className="space-y-4">
      <dl className="divide-y rounded-lg border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm break-words text-foreground">{row.value}</dd>
            </div>
            <EditButton onClick={() => onEdit(row.stepIndex)} />
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 p-3">
          <div className="min-w-0 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Descrição</dt>
            <dd className="line-clamp-6 text-sm whitespace-pre-line text-foreground">{description.trim()}</dd>
            {files.length > 0 && (
              <dd className="pt-1 text-xs text-muted-foreground">
                <Paperclip className="mr-1 inline size-3" />
                {files.map((file) => file.name).join(", ")}
              </dd>
            )}
          </div>
          <EditButton onClick={() => onEdit(descriptionIndex)} />
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">Você vai receber as atualizações do chamado por e-mail e pode acompanhá-lo em “Meus chamados”.</p>
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="shrink-0">
      <Pencil className="size-3.5" />
      Alterar
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function CreatedScreen({ ticket, onRestart }: { ticket: CreatedTicket; onRestart: () => void }) {
  return (
    <div className="space-y-6 rounded-xl border bg-card p-8 text-center sm:p-12">
      <CircleCheck className="mx-auto size-12 text-primary" strokeWidth={1.5} />
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Chamado #{ticket.number} aberto</h2>
        <p className="text-sm text-muted-foreground">O setor já recebeu o seu pedido. As respostas da equipe chegam no seu e-mail.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/chamados">Ver meus chamados</Link>
        </Button>
        {ticket.url && (
          <Button variant="outline" asChild>
            <a href={ticket.url} target="_blank" rel="noreferrer">
              Abrir no Zammad
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        <Button variant="ghost" onClick={onRestart}>
          Abrir outro chamado
        </Button>
      </div>
    </div>
  );
}
