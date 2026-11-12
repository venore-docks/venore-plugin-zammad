import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { Button } from "@venore/plugin-sdk/ui";
import { listMyTickets } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";

// Meus chamados: os que a pessoa abriu, separados por "o que precisa de você" (a equipe respondeu → em
// andamento → encerrados). Cada linha abre a conversa na mesma superfície; o Zammad não aparece.
export async function MyTicketsView({ surfaceKey }: { surfaceKey: SurfaceKey }) {
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
        />
      ) : (
        <div className="space-y-8">
          <TicketGroup title="A equipe respondeu — sua vez" tickets={result.data.tickets.filter((t) => t.awaitingYou)} hrefFor={surface.detail} waiting />
          <TicketGroup title="Em andamento" tickets={result.data.tickets.filter((t) => !t.awaitingYou && !t.closed)} hrefFor={surface.detail} />
          <TicketGroup title="Encerrados" tickets={result.data.tickets.filter((t) => t.closed)} hrefFor={surface.detail} muted />
        </div>
      )}
    </ColaboraFrame>
  );
}
