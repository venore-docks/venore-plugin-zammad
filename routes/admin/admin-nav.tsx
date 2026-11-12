"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@venore/plugin-sdk/ui";

const BASE = "/admin/colabora";

// Seções da administração. `exact`: a visão geral só fica ativa no endereço exato.
const SECTIONS = [
  { href: BASE, label: "Visão geral", exact: true },
  { href: `${BASE}/setores`, label: "Setores", exact: false },
  { href: `${BASE}/grupos`, label: "Grupos de pessoas", exact: false },
  { href: `${BASE}/app`, label: "App", exact: false },
  { href: `${BASE}/textos`, label: "Textos", exact: false },
];

export function AdminNav() {
  const pathname = usePathname().replace(/\/$/, "");
  return (
    <nav aria-label="Seções do Colabora" className="overflow-x-auto border-b">
      <ul className="flex min-w-max items-center gap-1">
        {SECTIONS.map((section) => {
          const active = section.exact ? pathname === section.href : pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
