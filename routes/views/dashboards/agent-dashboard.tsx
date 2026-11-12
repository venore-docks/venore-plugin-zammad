import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Button, cn } from "@venore/plugin-sdk/ui";
import { getAgentDashboardHandler } from "../../../features/get-agent-dashboard/handler";
import { surfaceFor } from "../../../shared/routes";
import { AgentTicketList } from "./agent/ticket-rows";
import type { DashboardProps } from "./types";

// Dashboard do agente: "Meu atendimento". Só o que está atribuído a ele (a fila é do gestor).
export async function AgentDashboard({ surfaceKey }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const result = await getAgentDashboardHandler();
  const now = new Date();

  if (!result.success) {
    return (
      <section className="space-y-2 rounded-xl border bg-card p-5" aria-label="Meu atendimento">
        <h2 className="text-lg font-semibold text-foreground">Meu atendimento</h2>
        <p className="text-sm text-muted-foreground">{result.error.message}</p>
      </section>
    );
  }

  const { stats, needsReply, inProgress } = result.data;
  const allDone = stats.open === 0;

  return (
    <section className="space-y-6 rounded-xl border bg-card p-4 sm:p-6" aria-label="Meu atendimento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Meu atendimento</h2>
          <p className="text-sm text-muted-foreground">O que está com você agora.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={surface.assigned}>
            Ver todos os atribuídos
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Atribuídos em aberto" value={stats.open} />
        <Kpi label="Aguardando sua resposta" value={stats.awaiting} tone="warning" />
        <Kpi label="Urgentes ou alta prioridade" value={stats.urgent} tone="destructive" />
        <Kpi label="Sem retorno há mais de 24 h" value={stats.stale} tone="warning" />
      </dl>

      {allDone ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
          <CircleCheck className="size-8 text-success" aria-hidden />
          <p className="font-medium text-foreground">Tudo em dia</p>
          <p className="max-w-sm text-sm text-muted-foreground">Nenhum chamado atribuído a você no momento. Quando chegar um, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {needsReply.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Precisam da sua resposta</h3>
              <AgentTicketList tickets={needsReply} hrefFor={surface.detail} now={now} label="Precisam da sua resposta" />
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
              Ninguém esperando resposta sua. Bom trabalho!
            </p>
          )}
          {inProgress.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Em andamento</h3>
              <AgentTicketList tickets={inProgress} hrefFor={surface.detail} now={now} label="Em andamento" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" }) {
  const hot = value > 0 && tone;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col-reverse justify-end gap-1 rounded-xl border p-4",
        hot && tone === "warning" && "border-warning-border bg-warning-soft",
        hot && tone === "destructive" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">{value}</dd>
    </div>
  );
}
