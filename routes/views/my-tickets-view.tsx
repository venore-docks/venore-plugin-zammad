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
import { LinkPending } from "../public/link-pending";

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

  // "Abrir chamado" vem da moldura (botão de contorno no canto do título).
  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="mine"
      title="Meus chamados"
      subtitle="Acompanhe os seus pedidos e converse com a equipe de cada setor."
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
      {/* Filtros como segmentos discretos; o único número com cor é "Aguardando você" (pede ação). */}
      <nav aria-label="Filtrar chamados" className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="inline-flex w-max gap-1 rounded-md border bg-card p-1 text-sm">
          {MINE_FILTERS.map((item) => {
            const active = item === filter;
            const pending = item === "aguardando" && counts.aguardando > 0;
            return (
              <li key={item}>
                <Link
                  href={item === "todos" ? surface.mine : `${surface.mine}?filtro=${item}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded px-3 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {FILTER_LABEL[item]}
                  <span className={cn("text-xs tabular-nums", pending ? "font-semibold text-warning" : "text-muted-foreground")}>{counts[item]}</span>
                  <LinkPending />
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
          <TicketGroup title="Esperam a sua resposta" tickets={visible.filter((t) => !t.closed && t.awaitingYou)} hrefFor={surface.detail} waiting />
          <TicketGroup title="Em andamento" tickets={visible.filter((t) => !t.awaitingYou && !t.closed)} hrefFor={surface.detail} />
          <TicketGroup title="Encerrados" tickets={visible.filter((t) => t.closed)} hrefFor={surface.detail} muted />
        </div>
      ) : (
        <TicketGroup title={FILTER_LABEL[filter]} tickets={visible} hrefFor={surface.detail} waiting={filter === "aguardando"} muted={filter === "encerrados"} />
      )}
    </div>
  );
}
