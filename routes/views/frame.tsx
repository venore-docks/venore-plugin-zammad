import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, cn } from "@venore/plugin-sdk/ui";
import type { AppViewer } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { AppShell } from "../app/shell";
import { navItemsFor, type NavKey } from "./nav";
import { ViewAsBar } from "./view-as-bar";
import { LinkPending } from "../public/link-pending";
import { SCROLL_TAB_CLASS, ScrollTabs } from "./scroll-tabs";

// Moldura de toda tela do Colabora. Mesma API nas duas superfícies; só o desenho muda:
//   app    → AppShell (cabeçalho fixo + abas embaixo), SEM a casca do Venore Docks;
//   portal → conteúdo dentro da casca do site, com título e a navegação do Colabora em pílulas.
export type FrameProps = {
  surfaceKey: SurfaceKey;
  /** Quem está vendo (define a navegação). Sem ele (erro de carga), a moldura sai sem navegação. */
  viewer: AppViewer | null;
  /** Item de navegação ativo; null em telas de detalhe. */
  active: NavKey | null;
  title: string;
  subtitle?: string;
  /** Link "voltar" (no app vira a seta do cabeçalho). */
  backHref?: string;
  /** Texto do link "voltar" quando ele não leva à lista (ex.: "Voltar ao chamado pai #123"). */
  backLabel?: string;
  /** Números nas abas/pílulas (ex.: fila, atribuídos). */
  counts?: Partial<Record<NavKey, number>>;
  /** Ações no canto do título (só no portal). */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function ColaboraFrame({ surfaceKey, viewer, active, title, subtitle, backHref, backLabel, counts, actions, children }: FrameProps) {
  const surface = surfaceFor(surfaceKey);
  if (surfaceKey === "app") {
    return (
      <AppShell
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        backLabel={backLabel}
        // Telas de detalhe (active=null) ficam sem a barra de abas: a resposta ocupa o rodapé.
        nav={viewer && active ? { active, items: navItemsFor(surface, viewer), counts } : undefined}
      >
        <div className="space-y-4">
          <ViewAsBar showPicker={active === "home"} homeHref={surface.home} />
          {children}
        </div>
      </AppShell>
    );
  }

  // Portal (regra de design do core, `.claude/rules/ui-design.md`): título sem rótulo em maiúsculas, abas
  // sublinhadas (indicador por sombra interna — `border-b-2 -mb-px` num container com overflow cria barra de
  // rolagem), contador discreto. "Abrir chamado" não é aba: vira botão de contorno no canto do título, em TODAS as
  // telas (inclusive o chamado), menos a própria tela de abertura e o Início do colaborador — lá a lista de setores
  // já é o "abrir chamado". O Início da equipe (gestor/agente) não tem esse atalho, então o botão aparece.
  const items = viewer ? navItemsFor(surface, viewer).filter((item) => item.key !== "new") : [];
  const newTicketAction =
    viewer && actions === undefined && active !== "new" && !(active === "home" && !viewer.isStaff) ? (
      <Button asChild variant="outline" size="sm">
        <Link href={surface.newTicket}>
          <Plus className="size-4" />
          Novo chamado
        </Link>
      </Button>
    ) : null;
  return (
    <div className="w-full max-w-5xl space-y-6 pt-2 pb-8">
      <header className="space-y-5">
        {backHref && (
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {backLabel ?? "Voltar"}
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions ?? newTicketAction}
        </div>
        {items.length > 0 && (
          <ScrollTabs label="Navegação do Colabora" className="gap-6">
            {items.map((item) => {
              const isActive = item.key === active;
              const count = counts?.[item.key] ?? 0;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    SCROLL_TAB_CLASS,
                    "rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive ? "font-medium text-foreground shadow-[inset_0_-2px_0_var(--color-primary)]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {count > 0 && (
                    <span className="ms-1.5 rounded-full bg-muted px-1.5 py-px text-xs text-muted-foreground tabular-nums" title={item.key === "queue" ? `${count} aguardando a sua decisão` : undefined}>
                      {count}
                      {item.key === "queue" && <span className="sr-only"> aguardando a sua decisão</span>}
                    </span>
                  )}
                  <LinkPending />
                </Link>
              );
            })}
          </ScrollTabs>
        )}
      </header>
      <ViewAsBar showPicker={active === "home"} homeHref={surface.home} />
      {children}
    </div>
  );
}
