import { Inbox } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { getTeamOverview, listAgentTickets } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";

// Equipe > um agente: os chamados em aberto atribuídos a ele (só gestor/admin).
export async function TeamAgentView({ surfaceKey, agentId }: { surfaceKey: SurfaceKey; agentId: number }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.teamAgent(agentId));
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="team" title="Equipe" backHref={surface.team}>
        <BlockedNotice title="Equipe" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;
  if (!viewer.isSupervisor) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="home" title="Equipe">
        <BlockedNotice title="Área do gestor" message="Só o gestor vê a equipe." />
      </ColaboraFrame>
    );
  }

  const [tickets, team] = await Promise.all([listAgentTickets({ kind: "of-agent", agentId }), getTeamOverview()]);
  const name = team.success ? team.data.members.find((member) => member.id === agentId)?.name : undefined;

  return (
    <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="team" title={name ?? "Chamados do agente"} subtitle="Equipe" backHref={surface.team}>
      {!tickets.success ? (
        <BlockedNotice title="Equipe" message={tickets.error.message} />
      ) : tickets.data.tickets.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="Nenhum chamado em aberto" description="Esta pessoa não tem chamados atribuídos no momento." />
      ) : (
        <div className="space-y-6">
          <TicketGroup title="O solicitante respondeu" tickets={tickets.data.tickets.filter((t) => t.awaitingYou)} hrefFor={surface.detail} waiting showRequester />
          <TicketGroup title="Em andamento" tickets={tickets.data.tickets.filter((t) => !t.awaitingYou)} hrefFor={surface.detail} showRequester />
        </div>
      )}
    </ColaboraFrame>
  );
}
