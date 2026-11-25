"use client";

import { Check } from "lucide-react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cn } from "@venore/plugin-sdk/ui";
import type { AnswerValue, WizardField } from "../../contracts/types";
import { localNow } from "../../shared/answers";

// Campo do formulário de um setor (vindo do Zammad). Usado pelo wizard de abertura e pelo chamado filho: as
// duas telas perguntam o mesmo campo do mesmo jeito.

// Selects com poucas opções viram botões (um toque); com muitas, lista suspensa.
const MAX_INLINE_OPTIONS = 6;

export function OptionChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function FieldInput({
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
                  "min-w-28 rounded-md border px-5 py-3 text-sm font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}
