import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { EmptyState, cn } from "@venore/plugin-sdk/ui";
import { getTeamOverview } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";

// Equipe: os agentes dos setores do gestor/admin e a carga de cada um. Tocar num agente mostra os chamados dele.
export async function TeamView({ surfaceKey }: { surfaceKey: SurfaceKey }) {
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

  const result = await getTeamOverview();
  return (
    <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="team" title="Equipe" subtitle="Agentes dos setores que você gerencia e a carga de cada um.">
      {!result.success ? (
        <BlockedNotice title="Equipe" message={result.error.message} />
      ) : (
        <div className="space-y-4">
          <Link
            href={surface.queue}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50",
              result.data.queue > 0 ? "border-warning-border bg-warning-soft" : "bg-card",
            )}
          >
            <span className="space-y-0.5">
              <span className="block text-sm font-semibold text-foreground">Sem responsável</span>
              <span className="block text-xs text-muted-foreground">{result.data.queue === 0 ? "Nada esperando alocação." : "Abra a fila para atribuir a um agente."}</span>
            </span>
            <span className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              {result.data.queue}
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
          </Link>

          {result.data.members.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="Equipe não encontrada" description="Nenhum agente responde pelos setores que você gerencia no Zammad." />
          ) : (
            <ul className="space-y-2">
              {result.data.members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={surface.teamAgent(member.id)}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-chart-6/20 text-xs font-semibold text-foreground">
                      {member.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{member.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {member.open} {member.open === 1 ? "chamado em aberto" : "chamados em aberto"}
                      </span>
                    </span>
                    {member.waiting > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground">{member.waiting} aguardando</span>}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ColaboraFrame>
  );
}
