import { percentOf, type LoadLevel } from "../../../../shared/manager-stats";

// Barra de carga de um agente: abertos (neutro) e, dentro deles, os que esperam resposta (âmbar — o único
// trecho que pede ação). A largura é relativa ao agente mais carregado; o texto ao lado diz os números.
export function LoadBar({ open, waiting, max }: { open: number; waiting: number; max: number }) {
  const rest = Math.max(0, open - waiting);
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${open} em aberto, ${waiting} aguardando resposta`}>
      <div className="bg-foreground/60" style={{ width: `${percentOf(rest, max)}%` }} />
      <div className="bg-warning" style={{ width: `${percentOf(waiting, max)}%` }} />
    </div>
  );
}

// Sinal sóbrio de carga: só nos extremos, em texto (a barra já mostra o tamanho).
export function LevelPill({ level }: { level: LoadLevel }) {
  if (level === "normal") return null;
  return <span className="shrink-0 text-xs text-muted-foreground">{level === "heavy" ? "carga alta" : "livre"}</span>;
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
