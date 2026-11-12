import Link from "next/link";
import { CircleCheck, Inbox } from "lucide-react";
import { EmptyState, cn } from "@venore/plugin-sdk/ui";
import { listAgentTickets } from "../../index";
import { ASSIGNED_FILTERS, filterCounts, filterTickets, parseAssignedFilter, type AssignedFilter } from "../../shared/agent-stats";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { enterSurface } from "./context";
import { AgentTicketList } from "./dashboards/agent/ticket-rows";
import { ColaboraFrame } from "./frame";
import type { ViewQuery } from "./query";

const EMPTY_FILTER: Record<AssignedFilter, string> = {
  todos: "Nada atribuído a você",
  aguardando: "Ninguém esperando resposta sua",
  urgentes: "Nenhum chamado urgente",
  pendentes: "Nenhum chamado pendente",
};

// Atribuídos a mim: os chamados que o agente (ou gestor/admin) recebeu para atender. O agente comum só vê o que
// lhe foi atribuído — nunca a fila. Filtros por aba (`?filtro=`), com os que esperam resposta e os urgentes na frente.
export async function AssignedView({ surfaceKey, query }: { surfaceKey: SurfaceKey; query?: ViewQuery }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.assigned);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="assigned" title="Atribuídos a mim">
        <BlockedNotice title="Atribuídos a mim" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;
  if (!viewer.isStaff) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="home" title="Atribuídos a mim">
        <BlockedNotice title="Área da equipe" message="Esta área é só para a equipe de atendimento." />
      </ColaboraFrame>
    );
  }

  const filter = parseAssignedFilter(query?.filtro);
  const result = await listAgentTickets({ kind: "assigned" });
  const now = new Date();
  const all = result.success ? result.data.tickets : [];
  const counts = filterCounts(all);
  const shown = filterTickets(all, filter);

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="assigned"
      title="Atribuídos a mim"
      subtitle="Chamados que estão com você para atender."
    >
      {!result.success ? (
        <BlockedNotice title="Atribuídos a mim" message={result.error.message} />
      ) : all.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="Nada atribuído a você" description="Quando um chamado for atribuído a você, ele aparece aqui." />
      ) : (
        <div className="space-y-5">
          <nav aria-label="Filtrar atribuídos" className="flex flex-wrap gap-2">
            {ASSIGNED_FILTERS.map((option) => {
              const active = option.key === filter;
              return (
                <Link
                  key={option.key}
                  href={option.key === "todos" ? surface.assigned : `${surface.assigned}?filtro=${option.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "border-primary bg-primary/10 font-medium text-foreground" : "bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {option.label}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", active ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground")}>{counts[option.key]}</span>
                </Link>
              );
            })}
          </nav>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
              <CircleCheck className="size-8 text-success" aria-hidden />
              <p className="font-medium text-foreground">{EMPTY_FILTER[filter]}</p>
              <p className="text-sm text-muted-foreground">Nada por aqui neste filtro.</p>
            </div>
          ) : (
            <AgentTicketList tickets={shown} hrefFor={surface.detail} now={now} label="Chamados atribuídos a você" />
          )}
        </div>
      )}
    </ColaboraFrame>
  );
}
