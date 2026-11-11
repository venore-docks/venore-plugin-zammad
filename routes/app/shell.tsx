import Link from "next/link";
import { ArrowLeft, Inbox, Layers, MessagesSquare, PlusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import { APP_BASE } from "../../shared/routes";

// Casca do app "Chamados": cabeçalho fixo + navegação inferior, no formato de app de celular. NÃO usa a
// casca do Venore Docks (a página roda sob /ext, fora do layout da plataforma). Respeita a área segura
// (notch e barra de gestos) via env(safe-area-inset-*), habilitada pelo viewport-fit=cover do layout raiz.
export type AppTab = "assigned" | "queue" | "mine" | "new";

type TabDef = { key: AppTab; label: string; href: string; icon: LucideIcon; agentOnly: boolean };

const TABS: TabDef[] = [
  { key: "assigned", label: "Atribuídos", href: `${APP_BASE}?aba=atribuidos`, icon: Inbox, agentOnly: true },
  { key: "queue", label: "Fila", href: `${APP_BASE}?aba=fila`, icon: Layers, agentOnly: true },
  { key: "mine", label: "Meus", href: `${APP_BASE}?aba=meus`, icon: MessagesSquare, agentOnly: false },
  { key: "new", label: "Novo", href: `${APP_BASE}/novo`, icon: PlusCircle, agentOnly: false },
];

export type AppNav = { active: AppTab; isAgent: boolean; counts?: Partial<Record<AppTab, number>> };

export function AppShell({
  title,
  subtitle,
  backHref,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  nav?: AppNav;
  children: React.ReactNode;
}) {
  const tabs = nav ? TABS.filter((tab) => nav.isAgent || !tab.agentOnly) : [];
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-1 px-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Voltar"
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <div className={cn("min-w-0 flex-1", !backHref && "ps-2")}>
            <h1 className="truncate text-base leading-tight font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-2xl flex-1 px-4 py-4", nav && "pb-28")}>{children}</main>

      {nav && (
        <nav aria-label="Navegação do app" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => {
              const active = nav.active === tab.key;
              const count = nav.counts?.[tab.key] ?? 0;
              return (
                <li key={tab.key}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="relative">
                      <tab.icon className="size-5" />
                      {count > 0 && (
                        <span className="absolute -end-3 -top-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </span>
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
