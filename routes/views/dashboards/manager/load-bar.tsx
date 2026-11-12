import { cn } from "@venore/plugin-sdk/ui";
import { percentOf, type LoadLevel } from "../../../../shared/manager-stats";

// Barra de carga de um agente: abertos (cor primária) e, dentro deles, os que esperam resposta (âmbar).
// A largura é relativa ao agente mais carregado; o texto ao lado diz os números (a barra é só reforço visual).
export function LoadBar({ open, waiting, max }: { open: number; waiting: number; max: number }) {
  const rest = Math.max(0, open - waiting);
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${open} em aberto, ${waiting} aguardando resposta`}>
      <div className="bg-primary" style={{ width: `${percentOf(rest, max)}%` }} />
      <div className="bg-warning" style={{ width: `${percentOf(waiting, max)}%` }} />
    </div>
  );
}

// Sinal sóbrio de carga: só aparece nos extremos.
export function LevelPill({ level }: { level: LoadLevel }) {
  if (level === "normal") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        level === "heavy" ? "border-warning-border bg-warning-soft text-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {level === "heavy" ? "Carga alta" : "Livre"}
    </span>
  );
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
