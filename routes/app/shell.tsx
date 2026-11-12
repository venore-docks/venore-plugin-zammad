import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { NavItem, NavKey } from "../views/nav";

// Casca do app Colabora: cabeçalho fixo + navegação inferior, no formato de app de celular. NÃO usa a casca do
// Venore Docks (a página roda sob /ext, fora do layout da plataforma). Respeita a área segura (notch e barra de
// gestos) via env(safe-area-inset-*), habilitada pelo viewport-fit=cover do layout raiz. As abas vêm de
// views/nav.ts (as mesmas pílulas do portal, por papel).
export type AppNav = { active: NavKey; items: NavItem[]; counts?: Partial<Record<NavKey, number>> };

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
  const items = nav?.items ?? [];
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

      {nav && items.length > 0 && (
        <nav aria-label="Navegação do app" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => {
              const active = nav.active === item.key;
              const count = nav.counts?.[item.key] ?? 0;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="relative">
                      <item.icon className="size-5" />
                      {count > 0 && (
                        <span className="absolute -end-3 -top-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </span>
                    {item.shortLabel}
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
