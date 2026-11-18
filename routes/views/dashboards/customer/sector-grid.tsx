import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SectorForm } from "../../../../contracts/types";
import { sectorIcon } from "../../../public/palette";
import { LIST_CLASS, ROW_LINK_CLASS } from "../../../public/shared";

// "Abrir um chamado": escolher o setor JÁ é abrir o chamado (leva ao wizard no setor escolhido). Regra de
// design: é o chamado à ação da home do colaborador — sem hero separado; ícones neutros, uma lista só.
export function SectorGrid({ sectors, newTicketHref }: { sectors: SectorForm[]; newTicketHref: string }) {
  if (sectors.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="colabora-sectors">
      <div className="space-y-1">
        <h2 id="colabora-sectors" className="text-lg font-semibold tracking-tight text-foreground">
          Abrir um chamado
        </h2>
        <p className="text-sm text-muted-foreground">Escolha o setor. Guiamos você pergunta por pergunta.</p>
      </div>
      <ul className={LIST_CLASS}>
        {sectors.map((sector) => (
          <li key={sector.groupId} className="min-w-0">
            <Link href={`${newTicketHref}?setor=${sector.groupId}`} className={ROW_LINK_CLASS}>
              <span className="shrink-0 text-muted-foreground">{sectorIcon(sector.label, "size-5")}</span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block truncate text-sm font-medium text-foreground">{sector.label}</span>
                {sector.description && <span className="line-clamp-2 block text-xs text-muted-foreground">{sector.description}</span>}
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
