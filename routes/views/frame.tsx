import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { AppViewer } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { AppShell } from "../app/shell";
import { navItemsFor, type NavKey } from "./nav";

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
  /** Números nas abas/pílulas (ex.: fila, atribuídos). */
  counts?: Partial<Record<NavKey, number>>;
  /** Ações no canto do título (só no portal). */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function ColaboraFrame({ surfaceKey, viewer, active, title, subtitle, backHref, counts, actions, children }: FrameProps) {
  const surface = surfaceFor(surfaceKey);
  if (surfaceKey === "app") {
    return (
      <AppShell
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        // Telas de detalhe (active=null) ficam sem a barra de abas: a resposta ocupa o rodapé.
        nav={viewer && active ? { active, items: navItemsFor(surface, viewer), counts } : undefined}
      >
        {children}
      </AppShell>
    );
  }

  const items = viewer ? navItemsFor(surface, viewer) : [];
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-8">
      <header className="space-y-5">
        {backHref && (
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Colabora</p>
            <h1 className="text-2xl font-semibold tracking-tight break-words text-foreground sm:text-3xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {items.length > 0 && (
          <nav aria-label="Navegação do Colabora" className="-mx-1 flex flex-wrap gap-1.5 border-b pb-3">
            {items.map((item) => {
              const isActive = item.key === active;
              const count = counts?.[item.key] ?? 0;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive
                      ? "bg-primary font-medium text-primary-foreground"
                      : item.key === "new"
                        ? "border border-primary/40 text-primary hover:bg-primary/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {count > 0 && (
                    <span className={cn("rounded-full px-1.5 text-xs font-semibold", isActive ? "bg-primary-foreground/20" : "bg-primary/15 text-primary")}>{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
