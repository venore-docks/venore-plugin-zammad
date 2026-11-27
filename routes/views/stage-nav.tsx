"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, cn } from "@venore/plugin-sdk/ui";
import { LinkPending } from "../public/link-pending";

// Navegação por etapa da Fila (mobile-first).
//   Celular   um botão com a etapa atual (bolinha, nome e contagem) abre uma gaveta com a lista completa: a lista de
//             11 etapas não empurra o conteúdo para baixo.
//   Tablet+   (md:) a mesma lista fica fixa numa coluna à esquerda.
// Os itens são links (a etapa vai na URL: ?etapa=...). `dot` é a classe da bolinha, que vem da paleta do plugin.

// note: texto no lugar do número quando a etapa não é contada (Finalizado mostra só os mais recentes).
export type StageNavEntry = { key: string; label: string; count: number | null; href: string; dot: string | null; note?: string };
export type StageNavGroup = { label: string; entries: StageNavEntry[] };

const GROUP_LABEL = "px-3 pt-4 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase";

function StageLink({ entry, active, onNavigate }: { entry: StageNavEntry; active: boolean; onNavigate?: () => void }) {
  const empty = entry.count === 0 && !active;
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        // 44 px de altura no celular (toque), 32 px de tablet em diante.
        "flex min-h-11 items-center gap-2.5 rounded-lg border border-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-8",
        active ? "border-border bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        empty && "opacity-60",
      )}
    >
      {entry.dot && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", entry.dot)} />}
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.count !== null ? (
        <span className={cn("text-xs tabular-nums", entry.count > 0 ? "font-semibold text-foreground" : "")}>{entry.count}</span>
      ) : (
        entry.note && <span className="text-xs text-muted-foreground">{entry.note}</span>
      )}
      <LinkPending />
    </Link>
  );
}

function StageList({ all, groups, activeKey, onNavigate }: { all: StageNavEntry; groups: StageNavGroup[]; activeKey: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-0.5">
      <StageLink entry={all} active={activeKey === all.key} onNavigate={onNavigate} />
      {groups.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className={GROUP_LABEL}>{group.label}</p>
          {group.entries.map((entry) => (
            <StageLink key={entry.key} entry={entry} active={activeKey === entry.key} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StageNav({
  all,
  groups,
  activeKey,
  decisionCount,
}: {
  all: StageNavEntry;
  groups: StageNavGroup[];
  activeKey: string;
  // Chamados que esperam a decisão do gestor (Novo, Em análise, Autorizado, Reavaliação).
  decisionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const active = activeKey === all.key ? all : (groups.flatMap((group) => group.entries).find((entry) => entry.key === activeKey) ?? all);

  return (
    <>
      <div className="space-y-2 md:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border bg-card px-3.5 text-start text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {active.dot && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", active.dot)} />}
            <span className="font-medium text-foreground">{active.label}</span>
            {active.count !== null ? (
              <span className="ms-auto font-semibold text-foreground tabular-nums">{active.count}</span>
            ) : (
              active.note && <span className="ms-auto text-xs text-muted-foreground">{active.note}</span>
            )}
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground", active.count === null && !active.note && "ms-auto")} />
            <span className="sr-only">Trocar de etapa</span>
          </button>
          <DialogContent
            className="top-auto bottom-0 left-0 max-h-[85dvh] max-w-none translate-x-0 translate-y-0 gap-2 overflow-y-auto rounded-t-2xl rounded-b-none p-3 pb-[max(1rem,env(safe-area-inset-bottom))] data-open:slide-in-from-bottom data-open:zoom-in-100 data-closed:slide-out-to-bottom data-closed:zoom-out-100 sm:max-w-none"
          >
            <DialogHeader className="px-1">
              <DialogTitle>Etapas</DialogTitle>
              <DialogDescription className="sr-only">Escolha a etapa dos chamados que quer ver.</DialogDescription>
            </DialogHeader>
            <nav aria-label="Etapas">
              <StageList all={all} groups={groups} activeKey={activeKey} onNavigate={() => setOpen(false)} />
            </nav>
          </DialogContent>
        </Dialog>
        {decisionCount > 0 && (
          <p className="px-1 text-sm text-muted-foreground">
            Aguardando a sua decisão: <b className="font-semibold text-foreground tabular-nums">{decisionCount}</b>
          </p>
        )}
      </div>

      <nav aria-label="Etapas" className="hidden md:block">
        <StageList all={all} groups={groups} activeKey={activeKey} />
      </nav>
    </>
  );
}
