import type { SurfaceKey } from "../shared/routes";
import { AssignedView } from "./views/assigned-view";
import { DashboardView } from "./views/dashboard-view";
import { MyTicketsView } from "./views/my-tickets-view";
import { NewTicketView } from "./views/new-ticket-view";
import { QueueView } from "./views/queue-view";
import { TeamAgentView } from "./views/team-agent-view";
import { TeamView } from "./views/team-view";
import { TicketView } from "./views/ticket-view";

// Componentes de página das duas superfícies, todos finos: só ligam os parâmetros da rota à "view" compartilhada
// (routes/views). Portal e app têm exatamente as mesmas telas; muda a moldura (frame) e a base do caminho.
function entriesFor(surfaceKey: SurfaceKey) {
  return {
    Home: () => <DashboardView surfaceKey={surfaceKey} />,
    Mine: () => <MyTicketsView surfaceKey={surfaceKey} />,
    New: async ({ searchParams }: { searchParams: Promise<{ setor?: string }> }) => {
      const { setor } = await searchParams;
      return <NewTicketView surfaceKey={surfaceKey} setor={setor} />;
    },
    Assigned: () => <AssignedView surfaceKey={surfaceKey} />,
    Queue: () => <QueueView surfaceKey={surfaceKey} />,
    Team: () => <TeamView surfaceKey={surfaceKey} />,
    TeamAgent: async ({ params }: { params: Promise<{ agentId: string }> }) => {
      const { agentId } = await params;
      return <TeamAgentView surfaceKey={surfaceKey} agentId={Number(agentId)} />;
    },
    Ticket: async ({ params }: { params: Promise<{ ticketId: string }> }) => {
      const { ticketId } = await params;
      return <TicketView surfaceKey={surfaceKey} ticketId={Number(ticketId)} />;
    },
  };
}

export const portalEntries = entriesFor("portal");
export const appEntries = entriesFor("app");
