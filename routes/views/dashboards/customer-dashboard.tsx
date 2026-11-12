import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { getCustomerDashboardHandler } from "../../../features/get-customer-dashboard/handler";
import { surfaceFor } from "../../../shared/routes";
import { MineSummary } from "./customer/mine-summary";
import { SectorGrid } from "./customer/sector-grid";
import type { DashboardProps } from "./types";

// Dashboard do colaborador: a chamada principal é "Abrir chamado"; abaixo, os setores acionáveis e o resumo de
// "Meus chamados". Com `compact` (abaixo do painel de agente/gestor) some a grade de setores.
export async function CustomerDashboard({ surfaceKey, compact = false }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const result = await getCustomerDashboardHandler();

  if (!result.success) {
    return (
      <section className="rounded-xl border border-warning-border bg-warning-soft p-5 text-sm text-foreground" aria-label="Meus chamados">
        {result.error.message}
      </section>
    );
  }
  const data = result.data;

  return (
    <div className="space-y-8">
      <section
        aria-label="Abrir chamado"
        className={compact ? "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4" : "flex flex-col gap-5 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"}
      >
        <div className="min-w-0 space-y-1">
          <p className={compact ? "font-semibold text-foreground" : "text-xl font-semibold tracking-tight text-foreground sm:text-2xl"}>Precisa de ajuda de um setor?</p>
          <p className="text-sm text-muted-foreground">Abra um chamado: guiamos você pergunta por pergunta e você acompanha tudo por aqui.</p>
        </div>
        <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
          <Link href={surface.newTicket}>
            <Plus className="size-5" />
            Abrir chamado
          </Link>
        </Button>
      </section>

      {!compact && <SectorGrid sectors={data.sectors} newTicketHref={surface.newTicket} />}
      <MineSummary data={data} surface={surface} compact={compact} />
    </div>
  );
}
