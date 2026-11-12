import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { EmptyState, cn } from "@venore/plugin-sdk/ui";
import { getTeamOverview } from "../../index";
import { hrefWith, maxOpen, parseSectorFilter, rankLoads } from "../../shared/manager-stats";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { enterSurface } from "./context";
import { LevelPill, LoadBar, initialsOf } from "./dashboards/manager/load-bar";
import { ColaboraFrame } from "./frame";
import type { ViewQuery } from "./query";

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary bg-primary font-medium text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

// Equipe: os agentes dos setores do gestor/admin e a carga de cada um; filtro por setor (?setor=<id do grupo>),
// porque o admin enxerga praticamente todos os agentes. Tocar num agente mostra os chamados dele.
export async function TeamView({ surfaceKey, query }: { surfaceKey: SurfaceKey; query?: ViewQuery }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.team);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="team" title="Equipe">
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

  const sectorId = parseSectorFilter(query?.setor);
  const result = await getTeamOverview();
  return (
    <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="team" title="Equipe" subtitle="Agentes dos setores que você gerencia e a carga de cada um.">
      {!result.success ? (
        <BlockedNotice title="Equipe" message={result.error.message} />
      ) : (
        (() => {
          const { members, groups, queue } = result.data;
          const groupName = new Map<number, string>(groups.map((group) => [group.id, group.name] as [number, string]));
          const visible = sectorId === undefined ? members : members.filter((member) => member.groupIds.includes(sectorId));
          const ranked = rankLoads(visible);
          const memberById = new Map(members.map((member) => [member.id, member]));
          const max = maxOpen(ranked);
          const totalOpen = visible.reduce((sum, member) => sum + member.open, 0);
          const totalWaiting = visible.reduce((sum, member) => sum + member.waiting, 0);

          return (
            <div className="space-y-5">
              <Link
                href={surface.queue}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  queue > 0 ? "border-warning-border bg-warning-soft" : "bg-card",
                )}
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-semibold text-foreground">Sem responsável</span>
                  <span className="block text-xs text-muted-foreground">{queue === 0 ? "Nada esperando alocação." : "Abra a fila para atribuir a um agente."}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-3xl font-semibold text-foreground tabular-nums">
                  {queue}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>

              {groups.length > 1 && (
                <nav aria-label="Filtrar por setor" className="flex flex-wrap gap-2">
                  <Chip href={surface.team} active={sectorId === undefined}>
                    Todos
                    <span className="text-xs opacity-80">{members.length}</span>
                  </Chip>
                  {groups.map((group) => (
                    <Chip key={group.id} href={hrefWith(surface.team, { setor: group.id })} active={group.id === sectorId}>
                      {group.name}
                      <span className="text-xs opacity-80">{members.filter((member) => member.groupIds.includes(group.id)).length}</span>
                    </Chip>
                  ))}
                </nav>
              )}

              {members.length === 0 ? (
                <EmptyState icon={<Users className="size-6" />} title="Equipe não encontrada" description="Nenhum agente responde pelos setores que você gerencia no Zammad." />
              ) : visible.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="Ninguém neste setor"
                  description="Nenhum agente responde por este setor."
                  action={
                    <Link href={surface.team} className="text-sm font-medium text-primary hover:underline">
                      Ver toda a equipe
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {visible.length} {visible.length === 1 ? "agente" : "agentes"} · {totalOpen} {totalOpen === 1 ? "chamado aberto" : "chamados abertos"}
                    {totalWaiting > 0 ? ` · ${totalWaiting} aguardando` : ""}
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {ranked.map((agent) => {
                      const member = memberById.get(agent.id);
                      const names = (member?.groupIds ?? []).map((id) => groupName.get(id)).filter((name): name is string => Boolean(name));
                      return (
                        <li key={agent.id}>
                          <Link
                            href={surface.teamAgent(agent.id)}
                            className="block space-y-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <span className="flex items-center gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-chart-6/20 text-xs font-semibold text-foreground">{initialsOf(agent.name)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{agent.name}</span>
                                {names.length > 0 && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {names.slice(0, 2).join(", ")}
                                    {names.length > 2 ? ` +${names.length - 2}` : ""}
                                  </span>
                                )}
                              </span>
                              <LevelPill level={agent.level} />
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            </span>
                            <LoadBar open={agent.open} waiting={agent.waiting} max={max} />
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground tabular-nums">
                              <span>
                                <strong className="text-base font-semibold text-foreground">{agent.open}</strong> {agent.open === 1 ? "aberto" : "abertos"}
                              </span>
                              {agent.waiting > 0 && <span>{agent.waiting} aguardando resposta</span>}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })()
      )}
    </ColaboraFrame>
  );
}
