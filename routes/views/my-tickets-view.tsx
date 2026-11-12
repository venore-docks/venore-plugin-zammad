import Link from "next/link";
import { BellRing, CircleCheck, Hourglass, LifeBuoy, Plus } from "lucide-react";
import { Button, EmptyState, cn } from "@venore/plugin-sdk/ui";
import type { TicketSummary } from "../../contracts/types";
import { listMyTickets } from "../../index";
import { MINE_FILTERS, countByFilter, filterTickets, parseMineFilter, type MineFilter } from "../../shared/customer-stats";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";
import type { ViewQuery } from "./query";

const FILTER_LABEL: Record<MineFilter, string> = {
  todos: "Todos",
  andamento: "Em andamento",
  aguardando: "Aguardando você",
  encerrados: "Encerrados",
};

const EMPTY_BY_FILTER: Record<Exclude<MineFilter, "todos">, { icon: React.ReactNode; title: string; description: string }> = {
  andamento: { icon: <Hourglass className="size-6" />, title: "Nada em andamento", description: "Você não tem chamados abertos no momento." },
  aguardando: { icon: <BellRing className="size-6" />, title: "Nenhum chamado esperando você", description: "Quando a equipe responder e precisar de algo seu, ele aparece aqui." },
  encerrados: { icon: <CircleCheck className="size-6" />, title: "Nenhum chamado encerrado", description: "Os chamados concluídos ficam guardados aqui para consulta." },
};

// Meus chamados: os que a pessoa abriu, com abas (?filtro=todos|andamento|aguardando|encerrados) e contagens,
// do mais recentemente atualizado para o mais antigo. Cada linha abre a conversa na mesma superfície.
export async function MyTicketsView({ surfaceKey, query }: { surfaceKey: SurfaceKey; query?: ViewQuery }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.mine);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="mine" title="Meus chamados">
        <BlockedNotice title="Meus chamados" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;

  const result = await listMyTickets();
  const filter = parseMineFilter(query?.filtro);
  const actions = (
    <Button asChild>
      <Link href={surface.newTicket}>
        <Plus className="size-4" />
        Abrir chamado
      </Link>
    </Button>
  );

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="mine"
      title="Meus chamados"
      subtitle="Acompanhe os seus pedidos e converse com a equipe de cada setor."
      actions={surfaceKey === "portal" ? actions : undefined}
    >
      {!result.success ? (
        <BlockedNotice title="Meus chamados" message={result.error.message} />
      ) : result.data.tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="size-6" />}
          title="Nenhum chamado ainda"
          description="Quando precisar de algo de um setor, abra um chamado — guiamos você pergunta por pergunta."
          action={
            <Button asChild>
              <Link href={surface.newTicket}>
                <Plus className="size-4" />
                Abrir chamado
              </Link>
            </Button>
          }
        />
      ) : (
        <MineList tickets={result.data.tickets} filter={filter} surface={surface} />
      )}
    </ColaboraFrame>
  );
}

function MineList({ tickets, filter, surface }: { tickets: TicketSummary[]; filter: MineFilter; surface: ReturnType<typeof surfaceFor> }) {
  const counts = countByFilter(tickets);
  const visible = filterTickets(tickets, filter);

  return (
    <div className="space-y-6">
      <nav aria-label="Filtrar chamados" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex w-max min-w-full gap-2">
          {MINE_FILTERS.map((item) => {
            const active = item === filter;
            return (
              <li key={item}>
                <Link
                  href={item === "todos" ? surface.mine : `${surface.mine}?filtro=${item}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "border-primary bg-primary font-medium text-primary-foreground" : "bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
                    !active && item === "aguardando" && counts.aguardando > 0 && "border-warning-border bg-warning-soft",
                  )}
                >
                  {FILTER_LABEL[item]}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{counts[item]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {visible.length === 0 && filter !== "todos" ? (
        <EmptyState icon={EMPTY_BY_FILTER[filter].icon} title={EMPTY_BY_FILTER[filter].title} description={EMPTY_BY_FILTER[filter].description} />
      ) : filter === "todos" ? (
        <div className="space-y-8">
          <TicketGroup title="A equipe respondeu — sua vez" tickets={visible.filter((t) => !t.closed && t.awaitingYou)} hrefFor={surface.detail} waiting />
          <TicketGroup title="Em andamento" tickets={visible.filter((t) => !t.awaitingYou && !t.closed)} hrefFor={surface.detail} />
          <TicketGroup title="Encerrados" tickets={visible.filter((t) => t.closed)} hrefFor={surface.detail} muted />
        </div>
      ) : (
        <TicketGroup title={FILTER_LABEL[filter]} tickets={visible} hrefFor={surface.detail} waiting={filter === "aguardando"} muted={filter === "encerrados"} />
      )}
    </div>
  );
}
