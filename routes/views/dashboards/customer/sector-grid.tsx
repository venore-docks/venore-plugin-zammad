import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { SectorForm } from "../../../../contracts/types";
import { accentFor, sectorIcon } from "../../../public/palette";

// "Para quem é o seu pedido?": um cartão por setor raiz, cada um leva ao wizard já no setor escolhido.
export function SectorGrid({ sectors, newTicketHref }: { sectors: SectorForm[]; newTicketHref: string }) {
  if (sectors.length === 0) return null;
  return (
    <section className="space-y-4" aria-labelledby="colabora-sectors">
      <h2 id="colabora-sectors" className="text-lg font-semibold tracking-tight text-foreground">
        Para quem é o seu pedido?
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sectors.map((sector) => {
          const accent = accentFor(sector.groupId);
          return (
            <li key={sector.groupId} className="min-w-0">
              <Link
                href={`${newTicketHref}?setor=${sector.groupId}`}
                className="group flex h-full items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg text-foreground", accent.soft)}>{sectorIcon(sector.label, "size-5")}</span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block truncate font-medium text-foreground">{sector.label}</span>
                  {sector.description && <span className="line-clamp-2 block text-xs text-muted-foreground">{sector.description}</span>}
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
