import Link from "next/link";
import { Check, Layers } from "lucide-react";
import { EmptyState, cn } from "@venore/plugin-sdk/ui";
import { getQueueBoardHandler } from "../../features/get-manager-dashboard/handler";
import { hrefWith, parseQueueSort, parseSectorFilter, shortGroupName, sortQueue, type QueueSort } from "../../shared/manager-stats";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { enterSurface } from "./context";
import { QueueRow } from "./dashboards/manager/queue-row";
import { ColaboraFrame } from "./frame";
import type { ViewQuery } from "./query";

const SORTS: { key: QueueSort; label: string }[] = [
  { key: "idade", label: "Mais antigos" },
  { key: "prioridade", label: "Prioridade" },
];

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

// Fila: chamados sem responsável, nos setores do gestor/admin. É de onde ele aloca (alocação rápida em cada linha).
// O agente comum NÃO vê a fila. Filtros por URL: ?setor=<id do grupo>&ordem=idade|prioridade.
export async function QueueView({ surfaceKey, query }: { surfaceKey: SurfaceKey; query?: ViewQuery }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.queue);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="queue" title="Fila">
        <BlockedNotice title="Fila" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;
  if (!viewer.isSupervisor) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="home" title="Fila">
        <BlockedNotice title="Área do gestor" message="A fila de chamados sem responsável é do gestor." />
      </ColaboraFrame>
    );
  }

  const sectorId = parseSectorFilter(query?.setor);
  const sort = parseQueueSort(query?.ordem);
  const result = await getQueueBoardHandler();

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="queue"
      title="Fila"
      subtitle="Chamados sem responsável. Escolha quem vai atendê-los."
      counts={result.success ? { queue: result.data.items.length } : undefined}
    >
      {!result.success ? (
        <BlockedNotice title="Fila" message={result.error.message} />
      ) : result.data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="text-base font-semibold text-foreground">Fila zerada</p>
          <p className="text-sm text-muted-foreground">Nenhum chamado sem responsável nos seus setores.</p>
        </div>
      ) : (
        (() => {
          const { items, sectors, allocation } = result.data;
          const filtered = sectorId === undefined ? items : items.filter((item) => item.groupId === sectorId);
          const sorted = sortQueue(filtered, sort);
          const sectorName = sectors.find((chip) => chip.id === sectorId)?.name;
          return (
            <div className="space-y-5">
              <div className="space-y-3">
                {sectors.length > 1 && (
                  <nav aria-label="Filtrar por setor" className="flex flex-wrap gap-2">
                    <Chip href={hrefWith(surface.queue, { ordem: sort === "idade" ? undefined : sort })} active={sectorId === undefined}>
                      Todos
                      <span className="text-xs opacity-80">{items.length}</span>
                    </Chip>
                    {sectors.map((chip) => (
                      <Chip key={chip.id} href={hrefWith(surface.queue, { setor: chip.id, ordem: sort === "idade" ? undefined : sort })} active={chip.id === sectorId}>
                        {shortGroupName(chip.name)}
                        <span className="text-xs opacity-80">{chip.count}</span>
                      </Chip>
                    ))}
                  </nav>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {sectorId === undefined
                      ? `${items.length} ${items.length === 1 ? "chamado" : "chamados"} sem responsável`
                      : `${sorted.length} de ${items.length} · ${sectorName ? shortGroupName(sectorName) : "setor"}`}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm" role="group" aria-label="Ordenar por">
                    <span className="text-muted-foreground">Ordenar:</span>
                    {SORTS.map((option) => (
                      <Link
                        key={option.key}
                        href={hrefWith(surface.queue, { setor: sectorId, ordem: option.key === "idade" ? undefined : option.key })}
                        aria-current={option.key === sort ? "true" : undefined}
                        className={cn(
                          "rounded-full px-2.5 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          option.key === sort ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {sorted.length === 0 ? (
                <EmptyState
                  icon={<Layers className="size-6" />}
                  title="Nenhum chamado deste setor"
                  description="A fila deste setor está zerada."
                  action={
                    <Link href={hrefWith(surface.queue, { ordem: sort === "idade" ? undefined : sort })} className="text-sm font-medium text-primary hover:underline">
                      Ver todos os setores
                    </Link>
                  }
                />
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {sorted.map((ticket) => (
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
          );
        })()
      )}
    </ColaboraFrame>
  );
}
