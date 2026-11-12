import { Inbox } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { getTeamOverview, listAgentTickets } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { enterSurface } from "./context";
import { LevelPill, LoadBar, initialsOf } from "./dashboards/manager/load-bar";
import { ColaboraFrame } from "./frame";
import { loadLevel, maxOpen } from "../../shared/manager-stats";

// Equipe > um agente: resumo da carga dele e os chamados em aberto atribuídos a ele (só gestor/admin).
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
  const overview = team.success ? team.data : null;
  const member = overview?.members.find((candidate) => candidate.id === agentId);
  const sectors = (member?.groupIds ?? []).map((id) => overview?.groups.find((group) => group.id === id)?.name).filter((name): name is string => Boolean(name));
  const level = member && overview ? loadLevel(member.open, overview.members) : "normal";
  const max = overview ? maxOpen(overview.members) : 1;

  return (
    <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="team" title={member?.name ?? "Chamados do agente"} subtitle="Equipe" backHref={surface.team}>
      <div className="space-y-6">
        {member && (
          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label="Resumo do agente">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-chart-6/20 text-sm font-semibold text-foreground">{initialsOf(member.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">{member.name}</p>
                {sectors.length > 0 && <p className="truncate text-xs text-muted-foreground">{sectors.join(", ")}</p>}
              </div>
              <LevelPill level={level} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-0.5 rounded-lg border bg-background p-3">
                <p className="text-3xl font-semibold text-foreground tabular-nums">{member.open}</p>
                <p className="text-xs text-muted-foreground">{member.open === 1 ? "chamado aberto" : "chamados abertos"}</p>
              </div>
              <div className="space-y-0.5 rounded-lg border bg-background p-3">
                <p className="text-3xl font-semibold text-foreground tabular-nums">{member.waiting}</p>
                <p className="text-xs text-muted-foreground">aguardando resposta</p>
              </div>
            </div>
            <LoadBar open={member.open} waiting={member.waiting} max={max} />
          </section>
        )}

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
      </div>
    </ColaboraFrame>
  );
}
