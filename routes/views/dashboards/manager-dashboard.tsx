import Link from "next/link";
import { Layers, Users } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { getTeamOverview } from "../../../index";
import { surfaceFor } from "../../../shared/routes";
import type { DashboardProps } from "./types";

// Dashboard do gestor/admin. (Versão de base: a frente "gestor" a aprimora — ver DashboardProps.)
export async function ManagerDashboard({ surfaceKey }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const team = await getTeamOverview();
  const overview = team.success ? team.data : null;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Gestão da equipe">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gestão da equipe</h2>
          <p className="text-sm text-muted-foreground">
            {overview ? `${overview.queue} na fila · ${overview.members.length} agentes` : "Não foi possível carregar a equipe agora."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href={surface.queue}>
              <Layers className="size-4" />
              Fila
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={surface.team}>
              <Users className="size-4" />
              Equipe
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
