"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  ChevronRight,
  CircleCheck,
  Inbox,
  Lightbulb,
  MessagesSquare,
  Paperclip,
  Pencil,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cn } from "@venore/plugin-sdk/ui";
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
import { matchesSearch } from "../../shared/customer-stats";
import { APP_SURFACE, PORTAL_SURFACE } from "../../shared/routes";
import { createTicketAction } from "./actions";
import { accentFor, sectorIcon, type Accent } from "./palette";

type StepDef =
  | { kind: "sector"; title: string }
  | { kind: "fields"; title: string; step: WizardStep }
  | { kind: "details"; title: string }
  | { kind: "review"; title: string };

const DEFAULT_INTRO = "Escolha o setor que pode ajudar. Se não tiver certeza, escolha o mais próximo — a equipe encaminha se for preciso.";
const DEFAULT_BODY_HINTS = [
  "O que você precisa ou o que aconteceu?",
  "Onde? (sala, prédio, sistema, equipamento)",
  "Desde quando, ou para quando precisa?",
  "Já tentou alguma coisa? Qual foi o resultado?",
];
// Selects com poucas opções viram botões (um toque); com muitas, lista suspensa.
const MAX_INLINE_OPTIONS = 6;
// Com mais setores que isto, o passo de setor ganha uma busca.
const SEARCH_FROM = 8;
// Espaço do cabeçalho fixo (casca do site ou cabeçalho do app) + respiro, ao rolar até o topo do formulário.
const HEADER_OFFSET = 88;

function initialAnswers(sector: SectorForm | undefined): Answers {
  const answers: Answers = {};
  for (const step of sector?.steps ?? []) {
    for (const field of step.fields) answers[field.name] = field.defaultValue;
  }
  return answers;
}

// surface: onde o wizard roda — decide para onde levam "Cancelar" e "Acompanhar este chamado" (função não
// atravessa a fronteira servidor→cliente, por isso só a chave).
export function TicketWizard({ data, initialGroupId, surface = "portal" }: { data: WizardData; initialGroupId: number | null; surface?: "portal" | "app" }) {
  const paths = surface === "app" ? APP_SURFACE : PORTAL_SURFACE;
  const sectors = data.sectors;
  const byId = useMemo(() => new Map(sectors.map((sector) => [sector.groupId, sector])), [sectors]);
  const initialSector = initialGroupId ? byId.get(initialGroupId) : undefined;

  const [groupId, setGroupId] = useState<number | null>(initialSector?.groupId ?? null);
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(initialSector));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [index, setIndex] = useState(initialSector ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedTicket | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const sector = groupId ? byId.get(groupId) : undefined;
  // Subgrupo (ex.: "Eventos::Som e Projeção") usa a cor do setor-pai.
  const rootId = sector ? (sector.parentId !== null && byId.has(sector.parentId) ? sector.parentId : sector.groupId) : 0;
  const accent = accentFor(rootId);
  const hasQuestions = (sector?.steps.length ?? 0) > 0;

  const steps: StepDef[] = [
    { kind: "sector", title: "Com qual setor você precisa falar?" },
    ...(sector?.steps ?? []).map((step): StepDef => ({ kind: "fields", title: step.title, step })),
    { kind: "details", title: "Agora, conte o que está precisando" },
    { kind: "review", title: "Tudo certo? Confira e envie" },
  ];
  const current = steps[Math.min(index, steps.length - 1)];
  const questionSteps = steps.filter((step) => step.kind === "fields");
  const questionNumber = current.kind === "fields" ? questionSteps.indexOf(current) + 1 : 0;

  // Troca de etapa: a nova etapa costuma ser mais curta que a anterior e o navegador ficaria no fim da página.
  // Depois de pintar a etapa nova, volta ao topo do formulário (descontando o cabeçalho fixo do site) e foca o
  // título sem deixar o foco mexer na rolagem.
  function goTo(next: number) {
    setErrors({});
    setIndex(next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        headingRef.current?.focus({ preventScroll: true });
        const form = formRef.current;
        if (!form) return;
        const top = form.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        if (Math.abs(window.scrollY - top) > 8) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }),
    );
  }

  // `advance`: a escolha é final (setor sem subdivisões, ou um assunto da subdivisão) → segue direto para a
  // próxima etapa, sem a pessoa ter de descer até "Continuar". Setor com subdivisões só abre a sub-escolha.
  function chooseSector(id: number, advance: boolean) {
    if (id !== groupId) {
      setGroupId(id);
      setAnswers(initialAnswers(byId.get(id)));
      setErrors({});
    }
    if (advance) goTo(1);
  }

  function validateCurrent(): boolean {
    let next: Record<string, string> = {};
    if (current.kind === "sector" && !sector) next = { sector: "Escolha o setor para continuar." };
    if (current.kind === "fields") next = validateFields(current.step.fields, answers);
    if (current.kind === "details") {
      const titleError = validateTitle(title);
      const descriptionError = validateDescription(description);
      const attachmentError = validateAttachments(files, data.limits);
      if (titleError) next.title = titleError;
      if (descriptionError) next.description = descriptionError;
      if (attachmentError) next.attachments = attachmentError;
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
    setTitle("");
    setDescription("");
    setFiles([]);
    setErrors({});
    setIndex(0);
  }

  if (created) return <CreatedScreen ticket={created} onRestart={restart} detailHref={paths.detail(created.id)} />;

  if (sectors.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-warning-border bg-warning-soft p-8 text-center text-sm text-foreground">
        <p className="font-medium">Nenhum setor está liberado para você ainda.</p>
        <p className="text-foreground/80">Fale com o gestor da sua área para pedir acesso.</p>
      </div>
    );
  }

  const phase = current.kind === "sector" ? 0 : current.kind === "fields" ? 1 : current.kind === "details" ? (hasQuestions ? 2 : 1) : hasQuestions ? 3 : 2;
  const phases = ["Setor", ...(!sector || hasQuestions ? ["Detalhes"] : []), "Pedido", "Revisão"];

  return (
    <form ref={formRef} onSubmit={handleNext} className="space-y-6" noValidate>
      <PhaseBar phases={phases} current={phase} />

      <section className={cn("space-y-6 rounded-xl border border-t-4 bg-card p-6 shadow-sm sm:p-8", sector ? accent.top : "border-t-primary")}>
        {sector && current.kind !== "sector" && <SectorTag sector={sector} accent={accent} />}

        <div className="space-y-1.5">
          {current.kind === "fields" && (
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Pergunta {questionNumber} de {questionSteps.length}
              {current.step.optional && <span className="ms-2 rounded-full bg-warning-soft px-2 py-0.5 text-warning normal-case">opcional</span>}
            </p>
          )}
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-foreground outline-none sm:text-2xl">
            {current.title}
          </h2>
        </div>

        {current.kind === "sector" && (
          <SectorStep intro={data.intro ?? DEFAULT_INTRO} sectors={sectors} selectedId={groupId} onSelect={chooseSector} error={errors.sector} />
        )}

        {current.kind === "fields" && (
          <div className="space-y-8">
            {current.step.optional && (
              <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-foreground">
                Esta etapa é opcional — pode seguir sem responder.
              </p>
            )}
            {current.step.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                showLabel={current.step.fields.length > 1 || current.step.title !== field.label}
                value={answers[field.name]}
                error={errors[field.name]}
                onChange={(value) => setAnswers((prev) => ({ ...prev, [field.name]: value }))}
              />
            ))}
          </div>
        )}

        {current.kind === "details" && (
          <DetailsStep
            hint={sector?.bodyHint ?? null}
            title={title}
            onTitle={setTitle}
            description={description}
            onDescription={setDescription}
            files={files}
            onFiles={setFiles}
            limits={data.limits}
            errors={errors}
          />
        )}

        {current.kind === "review" && sector && (
          <ReviewStep sector={sector} accent={accent} answers={answers} description={description} title={title} files={files} steps={steps} onEdit={goTo} />
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
            <Link href={paths.home}>Cancelar</Link>
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending} className="min-w-40">
          {current.kind === "review" ? (
            <>
              <Send className="size-4" />
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

// Fases do fluxo: concluída = verde com visto, atual = cor primária com halo, próxima = neutra.
function PhaseBar({ phases, current }: { phases: string[]; current: number }) {
  return (
    <ol className="flex items-start" aria-label="Etapas do chamado">
      {phases.map((label, position) => {
        const done = position < current;
        const active = position === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5 last:flex-none" aria-current={active ? "step" : undefined}>
            <div className="flex w-full items-center">
              {position > 0 && <span aria-hidden className={cn("h-0.5 flex-1 rounded-full", position <= current ? "bg-success" : "bg-border")} />}
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-success text-success-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : position + 1}
              </span>
              {position < phases.length - 1 && <span aria-hidden className={cn("h-0.5 flex-1 rounded-full", position < current ? "bg-success" : "bg-border")} />}
            </div>
            <span className={cn("text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground", !active && "hidden sm:block")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SectorTag({ sector, accent }: { sector: SectorForm; accent: Accent }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-foreground", accent.soft, accent.border)}>
      {sectorIcon(sector.label, "size-3.5")}
      {sector.label}
    </span>
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
  onSelect: (id: number, advance: boolean) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const subRef = useRef<HTMLDivElement>(null);
  const ids = new Set(sectors.map((sector) => sector.groupId));
  const allTopLevel = sectors.filter((sector) => sector.parentId === null || !ids.has(sector.parentId));
  const searchable = allTopLevel.length > SEARCH_FROM;
  // O setor já escolhido (ou pai do escolhido) nunca some da lista ao filtrar.
  const topLevel = searchable && search.trim() ? allTopLevel.filter((sector) => matchesSearch(`${sector.label} ${sector.description ?? ""}`, search)) : allTopLevel;
  const childrenOf = (id: number) => sectors.filter((sector) => sector.parentId === id);
  const selected = sectors.find((sector) => sector.groupId === selectedId);
  // Pai "aberto": o escolhido, ou o pai do subgrupo escolhido.
  const openParentId = selected ? (selected.parentId !== null && ids.has(selected.parentId) ? selected.parentId : selected.groupId) : null;
  const subOptions = openParentId !== null ? childrenOf(openParentId) : [];
  const parent = openParentId !== null ? sectors.find((sector) => sector.groupId === openParentId) : undefined;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{intro}</p>
      {searchable && (
        <div className="space-y-1.5">
          <label htmlFor="sector-search" className="sr-only">
            Buscar setor
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sector-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Buscar setor pelo nome…"
              autoComplete="off"
              className="h-11 ps-9"
            />
          </div>
          {search.trim() && topLevel.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              Nenhum setor encontrado para “{search.trim()}”. Tente outra palavra.
            </p>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {topLevel.map((sector) => {
          const active = openParentId === sector.groupId;
          const hasChildren = childrenOf(sector.groupId).length > 0;
          const accent = accentFor(sector.groupId);
          return (
            <button
              key={sector.groupId}
              type="button"
              onClick={() => {
                onSelect(sector.groupId, !hasChildren);
                // Com subdivisões, a pergunta "qual assunto" aparece abaixo da grade: rola até ela.
                if (hasChildren) requestAnimationFrame(() => subRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
              }}
              aria-pressed={active}
              className={cn(
                "group flex items-center gap-4 rounded-xl border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? cn("ring-2", accent.border, accent.ring, accent.soft) : "hover:border-foreground/30",
              )}
            >
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg text-foreground", accent.soft)}>
                {sectorIcon(sector.label, "size-5")}
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block font-medium text-foreground">{sector.label}</span>
                {sector.description && <span className="block text-xs text-muted-foreground">{sector.description}</span>}
              </span>
              {hasChildren ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                active && <CircleCheck className="size-5 shrink-0 text-success" />
              )}
            </button>
          );
        })}
      </div>

      {parent && subOptions.length > 0 && (
        <div ref={subRef} className={cn("scroll-mt-24 space-y-3 rounded-xl border p-4", accentFor(parent.groupId).soft, accentFor(parent.groupId).border)}>
          <p className="text-sm font-medium text-foreground">Qual é o assunto em {parent.label}?</p>
          <div className="flex flex-wrap gap-2">
            {[parent, ...subOptions].map((option) => (
              <OptionChip key={option.groupId} selected={selectedId === option.groupId} onClick={() => onSelect(option.groupId, true)}>
                {option.groupId === parent.groupId ? "Outro assunto" : option.label}
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
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected ? "border-primary bg-primary font-medium text-primary-foreground" : "bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
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
          {!field.required && <span className="ms-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>}
        </label>
      )}
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
          <p className="text-xs text-muted-foreground">Pode marcar mais de uma opção.</p>
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
            const selected = value === optionValue;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(optionValue)}
                aria-pressed={selected}
                className={cn(
                  "min-w-28 rounded-lg border px-5 py-3 text-sm font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
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

// Título + descrição + anexos numa tela só: é o "pedido" em si, e o resto já foi respondido.
function DetailsStep({
  hint,
  title,
  onTitle,
  description,
  onDescription,
  files,
  onFiles,
  limits,
  errors,
}: {
  hint: string | null;
  title: string;
  onTitle: (value: string) => void;
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
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="ticket-title" className="block font-medium text-foreground">
          Título do chamado
        </label>
        <p className="text-sm text-muted-foreground">
          Em poucas palavras: <strong className="text-foreground">o quê</strong> e <strong className="text-foreground">onde</strong>. Ex.: “Projetor da sala 204 não
          liga”.
        </p>
        <Input id="ticket-title" value={title} maxLength={TITLE_MAX} onChange={(event) => onTitle(event.target.value)} aria-invalid={Boolean(errors.title)} className="h-11 text-base" />
        <FieldError message={errors.title} />
      </div>

      <div className="space-y-3">
        <label htmlFor="ticket-description" className="block font-medium text-foreground">
          Descrição
        </label>
        <div className="flex gap-3 rounded-lg border border-chart-2/30 bg-chart-2/10 p-4">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-chart-2" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Ajuda a equipe se você contar:</p>
            <ul className="list-disc space-y-1 ps-5 text-sm text-foreground/80">
              {hints.map((line) => (
                <li key={line}>{line.replace(/^[-•*]\s*/, "")}</li>
              ))}
            </ul>
          </div>
        </div>
        <Textarea
          id="ticket-description"
          rows={7}
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="Escreva aqui com suas palavras…"
          aria-invalid={Boolean(errors.description)}
          className="text-base"
        />
        {remaining > 0 && description.length > 0 && <p className="text-xs text-muted-foreground">Mais {remaining} caracteres, pelo menos.</p>}
        <FieldError message={errors.description} />
      </div>

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
          Anexar foto ou arquivo
        </Button>
        <p className="text-xs text-muted-foreground">
          Opcional. Até {limits.maxFiles} arquivos, {formatBytes(limits.maxTotalBytes)} no total — prints e fotos ajudam muito.
        </p>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file, position) => (
              <li key={`${file.name}-${position}`} className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </span>
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
  accent,
  answers,
  description,
  title,
  files,
  steps,
  onEdit,
}: {
  sector: SectorForm;
  accent: Accent;
  answers: Answers;
  description: string;
  title: string;
  files: File[];
  steps: StepDef[];
  onEdit: (index: number) => void;
}) {
  const indexOf = (predicate: (step: StepDef) => boolean) => steps.findIndex(predicate);
  const detailsIndex = indexOf((step) => step.kind === "details");
  const rows: { label: string; value: string; stepIndex: number }[] = [
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

  return (
    <div className="space-y-6">
      <div className={cn("space-y-2 rounded-xl border p-4", accent.soft, accent.border)}>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Seu pedido</p>
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold text-foreground">{title.trim()}</p>
          <EditButton onClick={() => onEdit(detailsIndex)} />
        </div>
        <p className="line-clamp-6 text-sm whitespace-pre-line text-foreground/90">{description.trim()}</p>
        {files.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="size-3" />
            {files.map((file) => file.name).join(", ")}
          </p>
        )}
      </div>

      <dl className="divide-y rounded-xl border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm break-words text-foreground">{row.value}</dd>
            </div>
            <EditButton onClick={() => onEdit(row.stepIndex)} />
          </div>
        ))}
      </dl>

      <div className="rounded-xl border border-success-border bg-success-soft p-4">
        <p className="mb-3 text-sm font-medium text-foreground">O que acontece depois de enviar</p>
        <ol className="space-y-2.5 text-sm text-foreground/90">
          <li className="flex items-start gap-3">
            <Inbox className="mt-0.5 size-4 shrink-0 text-success" />A equipe de {sector.label} recebe o chamado na hora.
          </li>
          <li className="flex items-start gap-3">
            <MessagesSquare className="mt-0.5 size-4 shrink-0 text-success" />
            Você acompanha e conversa com a equipe aqui mesmo, em “Meus chamados”.
          </li>
          <li className="flex items-start gap-3">
            <BellRing className="mt-0.5 size-4 shrink-0 text-success" />
            Cada resposta também chega no seu e-mail.
          </li>
        </ol>
      </div>
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
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

function CreatedScreen({ ticket, onRestart, detailHref }: { ticket: CreatedTicket; onRestart: () => void; detailHref: string }) {
  return (
    <div className="space-y-6 rounded-xl border border-t-4 border-success-border border-t-success bg-success-soft p-8 text-center sm:p-12">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="size-8" strokeWidth={2.5} />
      </span>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Chamado #{ticket.number} enviado!</h2>
        <p className="mx-auto max-w-md text-sm text-foreground/80">O setor já recebeu o seu pedido. Quando a equipe responder, avisamos por e-mail e você conversa por aqui.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" asChild>
          <Link href={detailHref}>
            <MessagesSquare className="size-4" />
            Acompanhar este chamado
          </Link>
        </Button>
        <Button size="lg" variant="outline" onClick={onRestart}>
          Abrir outro chamado
        </Button>
      </div>
    </div>
  );
}
