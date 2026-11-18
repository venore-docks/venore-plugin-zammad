import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import { getManagerDashboardHandler } from "../../../features/get-manager-dashboard/handler";
import type { ManagerDashboardData } from "../../../features/get-manager-dashboard/types";
import { ageTone, formatAge, maxOpen } from "../../../shared/manager-stats";
import { surfaceFor } from "../../../shared/routes";
import { LIST_CLASS } from "../../public/shared";
import { LoadBar } from "./manager/load-bar";
import { QueueRow } from "./manager/queue-row";
import type { DashboardProps } from "./types";

const MAX_AGENT_ROWS = 8;

// Um número da faixa de indicadores: clicável, com uma linha de contexto. A cor fica só no contexto que pede
// ação (ex.: "mais antigo há 3 d").
function Stat({ label, value, hint, hintClass, href }: { label: string; value: number; hint: string; hintClass?: string; href: string }) {
  return (
    <Link href={href} className="block min-w-0 space-y-0.5 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
      <span className="block truncate text-xs text-muted-foreground">{label}</span>
      <span className="block text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
      <span className={cn("block truncate text-xs text-muted-foreground", hintClass)}>{hint}</span>
    </Link>
  );
}

// Dashboard do gestor/admin (regra de design): três números clicáveis numa faixa, a carga por agente e os mais
// antigos da fila com uma ação por linha. Fila e Equipe já estão nas abas: nada de botões repetidos.
export async function ManagerDashboard({ surfaceKey }: DashboardProps) {
  const result = await getManagerDashboardHandler();

  return (
    <section className="space-y-6" aria-label="Gestão da equipe">
      <h2 className="text-lg font-semibold text-foreground">Gestão da equipe</h2>
      {!result.success ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Não foi possível carregar a gestão da equipe agora. {result.error.message}</p>
      ) : (
        <ManagerBody surfaceKey={surfaceKey} data={result.data} />
      )}
    </section>
  );
}

function ManagerBody({ surfaceKey, data }: { surfaceKey: DashboardProps["surfaceKey"]; data: ManagerDashboardData }) {
  const surface = surfaceFor(surfaceKey);
  const { kpis, agents, queueTop, allocation, flowStateIds } = data;
  const max = maxOpen(agents);
  const shown = agents.slice(0, MAX_AGENT_ROWS);
  const oldestTone = kpis.queueOldestMs === null ? "fresh" : ageTone(kpis.queueOldestMs);

  return (
    <>
      <div className="grid grid-cols-1 divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Na fila"
          value={kpis.queue}
          hint={kpis.queueOldestMs === null ? "nada esperando" : `mais antigo há ${formatAge(kpis.queueOldestMs)}`}
          hintClass={oldestTone === "stale" ? "font-medium text-destructive" : oldestTone === "aging" ? "text-warning" : undefined}
          href={surface.queue}
        />
        <Stat
          label="Urgentes"
          value={kpis.urgent}
          hint="na fila e em atendimento"
          hintClass={kpis.urgent > 0 ? "font-medium text-destructive" : undefined}
          href={`${surface.queue}?ordem=prioridade`}
        />
        <Stat label="Solicitante respondeu" value={kpis.awaitingSupport} hint={`de ${kpis.inService} em atendimento`} href={surface.team} />
      </div>

      <div className="min-w-0 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Carga por agente</h3>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agente responde pelos setores que você gerencia.</p>
        ) : (
          <ul className="space-y-1">
            {shown.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={surface.teamAgent(agent.id)}
                  className="-mx-2 block space-y-1.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
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
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Fila: mais antigos primeiro</h3>
          {kpis.queue > queueTop.length && (
            <Link href={surface.queue} className="text-sm font-medium text-primary hover:underline">
              Ver os {kpis.queue}
            </Link>
          )}
        </div>
        {queueTop.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Fila zerada: todo chamado novo já tem responsável.</p>
        ) : (
          <ul className={LIST_CLASS}>
            {queueTop.map((ticket) => (
              <QueueRow
                key={ticket.id}
                ticket={ticket}
                href={surface.detail(ticket.id)}
                options={allocation.byGroup[ticket.groupId] ?? []}
                suggestedId={allocation.suggestedByGroup[ticket.groupId] ?? null}
                flowStateIds={flowStateIds}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
