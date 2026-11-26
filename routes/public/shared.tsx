import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import { Button } from "@venore/plugin-sdk/ui";
import type { TicketStateColor, TicketStateTone } from "../../contracts/types";
import { FLOW_BADGE } from "./palette";
import { Lock } from "lucide-react";

// Cada estado tem uma cor SEMÂNTICA (tokens do tema, ver palette.ts): informação = novo, primária = em
// andamento, alerta = em análise/aguardando, sucesso = autorizado/concluído, perigo = não autorizado,
// neutro = finalizado. Regra de design (core `.claude/rules/ui-design.md`): o selo é NEUTRO e só a bolinha
// leva a cor — cor forte fica para o que pede ação (ver `AwaitingBadge`). `tone` (legado) vira cor quando
// `color` não vem.
const TONE_COLOR: Record<TicketStateTone, TicketStateColor> = { new: "info", open: "primary", pending: "warning", closed: "neutral" };

function colorOf(tone: TicketStateTone, color?: TicketStateColor): TicketStateColor {
  return color ?? TONE_COLOR[tone];
}

export function StateBadge({ label, tone, color }: { label: string; tone: TicketStateTone; color?: TicketStateColor }) {
  const classes = FLOW_BADGE[colorOf(tone, color)];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground">
      {/* Encerrado (só Finalizado, no fluxo da FEM) leva cadeado no lugar da bolinha: o resto está em aberto. */}
      {tone === "closed" ? (
        <Lock aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      ) : (
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", classes.dot)} />
      )}
      {label}
      {tone === "closed" && <span className="sr-only"> (encerrado)</span>}
    </span>
  );
}

// O único selo com fundo colorido: algo espera a pessoa que está olhando.
export function AwaitingBadge({ label = "Aguardando você" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-warning-border bg-warning-soft px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground">
      {label}
    </span>
  );
}

// Lista padrão (regra de design): um cartão, linhas separadas por divisórias.
export const LIST_CLASS = "divide-y overflow-hidden rounded-lg border bg-card";
export const ROW_LINK_CLASS =
  "group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

// Mensagem de bloqueio (sem permissão, conta inexistente no Zammad, integração desligada).
export function BlockedNotice({ title, message, showBack = false }: { title: string; message: string; showBack?: boolean }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-lg border border-warning-border bg-warning-soft p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-foreground/80">{message}</p>
      {showBack && (
        <Button variant="outline" asChild>
          <Link href="/colabora">Voltar ao Colabora</Link>
        </Button>
      )}
    </div>
  );
}
