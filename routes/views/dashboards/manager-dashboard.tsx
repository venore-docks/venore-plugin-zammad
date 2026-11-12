import Link from "next/link";
import { BellRing, Check, ChevronRight, Flag, Layers, UserCheck, Users } from "lucide-react";
import { Button, cn } from "@venore/plugin-sdk/ui";
import { getManagerDashboardHandler } from "../../../features/get-manager-dashboard/handler";
import type { ManagerDashboardData } from "../../../features/get-manager-dashboard/types";
import { formatAge, maxOpen } from "../../../shared/manager-stats";
import { surfaceFor } from "../../../shared/routes";
import { LevelPill, LoadBar } from "./manager/load-bar";
import { QueueRow } from "./manager/queue-row";
import type { DashboardProps } from "./types";

const MAX_AGENT_ROWS = 8;

type KpiTone = "neutral" | "warning" | "danger";

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: KpiTone;
  icon: React.ReactNode;
  href?: string;
}) {
  const classes = cn(
    "block min-w-0 space-y-1 rounded-xl border p-4 transition-colors",
    tone === "warning" && "border-warning-border bg-warning-soft",
    tone === "danger" && "border-destructive/30 bg-destructive/5",
    tone === "neutral" && "bg-background",
    href && "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
  );
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="block text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">{value}</span>
      <span className="block truncate text-xs text-muted-foreground">{hint}</span>
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

// Dashboard do gestor/admin: KPIs, carga por agente e os mais antigos da fila com alocação rápida.
export async function ManagerDashboard({ surfaceKey }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const result = await getManagerDashboardHandler();

  return (
    <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6" aria-label="Gestão da equipe">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Gestão da equipe</h2>
          <p className="text-sm text-muted-foreground">Fila, carga dos agentes e alocação.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={surface.queue}>
              <Layers className="size-4" />
              Fila
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={surface.team}>
              <Users className="size-4" />
              Equipe
            </Link>
          </Button>
        </div>
      </div>

      {!result.success ? (
        <p className="rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-foreground">
          Não foi possível carregar a gestão da equipe agora. {result.error.message}
        </p>
      ) : (
        <ManagerBody surfaceKey={surfaceKey} data={result.data} />
      )}
    </section>
  );
}

function ManagerBody({ surfaceKey, data }: { surfaceKey: DashboardProps["surfaceKey"]; data: ManagerDashboardData }) {
  const surface = surfaceFor(surfaceKey);
  const { kpis, agents, queueTop, allocation } = data;
  const max = maxOpen(agents);
  const shown = agents.slice(0, MAX_AGENT_ROWS);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Na fila"
          value={kpis.queue}
          tone={kpis.queue > 0 ? "warning" : "neutral"}
          icon={<Layers className="size-3.5" aria-hidden />}
          hint={kpis.queueOldestMs === null ? "Nada esperando alocação" : `Mais antigo: ${formatAge(kpis.queueOldestMs)}`}
          href={surface.queue}
        />
        <Kpi label="Em atendimento" value={kpis.inService} icon={<UserCheck className="size-3.5" aria-hidden />} hint="Abertos com a equipe" href={surface.team} />
        <Kpi
          label="Aguardando atendimento"
          value={kpis.awaitingSupport}
          icon={<BellRing className="size-3.5" aria-hidden />}
          hint="O solicitante respondeu por último"
          href={surface.team}
        />
        <Kpi
          label="Urgentes"
          value={kpis.urgent}
          tone={kpis.urgent > 0 ? "danger" : "neutral"}
          icon={<Flag className="size-3.5" aria-hidden />}
          hint="Na fila e em atendimento"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">Carga por agente</h3>
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum agente responde pelos setores que você gerencia.</p>
          ) : (
            <ul className="space-y-1">
              {shown.map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={surface.teamAgent(agent.id)}
                    className="block space-y-1.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
                        <LevelPill level={agent.level} />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {agent.open} {agent.open === 1 ? "aberto" : "abertos"}
                        {agent.waiting > 0 ? ` · ${agent.waiting} aguardando` : ""}
                      </span>
                    </span>
                    <LoadBar open={agent.open} waiting={agent.waiting} max={max} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {agents.length > shown.length && (
            <Link href={surface.team} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver toda a equipe ({agents.length})
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>

        <div className="min-w-0 space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Fila — mais antigos</h3>
            {kpis.queue > queueTop.length && (
              <Link href={surface.queue} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Ver os {kpis.queue}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          {queueTop.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-success/15 text-success">
                <Check className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-medium text-foreground">Fila zerada</p>
              <p className="text-xs text-muted-foreground">Todo chamado novo já tem responsável.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {queueTop.map((ticket) => (
                <QueueRow
                  key={ticket.id}
                  ticket={ticket}
                  href={surface.detail(ticket.id)}
                  options={allocation.byGroup[ticket.groupId] ?? []}
                  suggestedId={allocation.suggestedByGroup[ticket.groupId] ?? null}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
