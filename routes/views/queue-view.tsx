import Link from "next/link";
import { Check, Layers, Tag } from "lucide-react";
import { EmptyState, cn } from "@venore/plugin-sdk/ui";
import { getQueueBoardHandler } from "../../features/get-manager-dashboard/handler";
import { hrefWith, parseQueueSort, parseSectorFilter, sectorChips, shortGroupName, sortQueue, type QueueSort } from "../../shared/manager-stats";
import { QUEUE_BUCKETS, bucketParam, parseBucket, pendingDecisions, type QueueBucket } from "../../shared/queue-buckets";
import { describeTags } from "../../shared/tag-labels";
import { FLOW_BADGE } from "../public/palette";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice, LIST_CLASS } from "../public/shared";
import { enterSurface } from "./context";
import { QueueRow } from "./dashboards/manager/queue-row";
import { ColaboraFrame } from "./frame";
import type { ViewQuery } from "./query";
import { LinkPending } from "../public/link-pending";

// Linhas por vez (o resto vem em "Mostrar mais", ?mais=<total>): menos HTML para o navegador.
const PAGE_SIZE = 25;
const MAX_LIMIT = 500;

function parseLimit(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > PAGE_SIZE ? Math.min(parsed, MAX_LIMIT) : PAGE_SIZE;
}

// Abas em que "nada aqui" quer dizer "fila zerada" (as que pedem decisão do gestor).
const PENDING_BUCKETS: QueueBucket[] = ["novo", "analise", "reavaliacao", "autorizado"];

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
        // Etapas como segmentos discretos (regra de design: nada de pílula cheia na cor primária).
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-foreground/30 bg-muted font-medium text-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      <LinkPending />
    </Link>
  );
}

// Filtro secundário (setor), mais discreto que as abas de etapa.
function SectorChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-foreground/40 bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      <LinkPending className="ms-1.5" />
    </Link>
  );
}

// Fila do gestor, por ETAPA do fluxo (uma aba por estado: Novo … Finalizado — ver shared/queue-buckets.ts), nos
// setores do gestor/admin. Cada card traz as decisões da etapa (analisar, autorizar, não autorizar, atribuir).
// O agente comum NÃO vê a fila. Filtros por URL: ?etapa=<etapa>&setor=<id do grupo>&ordem=idade|prioridade.
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
  const tagFilter = query?.tag?.trim() || undefined;
  const limit = parseLimit(query?.mais);
  // Só a aba pedida é completada (solicitante e tags); sem ?etapa, o servidor escolhe a primeira com decisão pendente.
  const result = await getQueueBoardHandler({ bucket: parseBucket(query?.etapa) });
  const ordem = sort === "idade" ? undefined : sort;

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="queue"
      title="Fila"
      subtitle="Os pedidos dos seus setores, por etapa: analise, autorize e atribua a um agente."
      counts={result.success ? { queue: pendingDecisions(result.data.counts) } : undefined}
    >
      {!result.success ? (
        <BlockedNotice title="Fila" message={result.error.message} />
      ) : (
        (() => {
          const { items, allocation, counts, uncounted, flowStateIds, bucket } = result.data;
          const bucketInfo = QUEUE_BUCKETS.find((entry) => entry.key === bucket);
          const sectors = sectorChips(items);
          const nothingPending = pendingDecisions(counts) === 0;
          // Tags presentes nesta etapa (com quantos chamados cada), na ordem de atenção (fluxo primeiro).
          const tagCount = new Map<string, number>();
          for (const item of items) for (const name of new Set(item.tags)) tagCount.set(name, (tagCount.get(name) ?? 0) + 1);
          const tagOptions = describeTags([...tagCount.keys()]);
          const tag = tagFilter && tagCount.has(tagFilter) ? tagFilter : undefined;
          const filtered = items.filter((item) => (sectorId === undefined || item.groupId === sectorId) && (tag === undefined || item.tags.includes(tag)));
          const sorted = sortQueue(filtered, sort);
          const filteredBy = sectorId !== undefined || tag !== undefined;
          const etapa = bucketParam(bucket);
          return (
            <div className="space-y-5">
              <nav aria-label="Etapas" className="flex flex-wrap gap-2">
                {QUEUE_BUCKETS.map((entry) => (
                  <Chip key={entry.key} href={hrefWith(surface.queue, { etapa: bucketParam(entry.key), ordem })} active={entry.key === bucket}>
                    {entry.label}
                    {!uncounted.includes(entry.key) && <span className="text-xs opacity-80">{counts[entry.key]}</span>}
                  </Chip>
                ))}
              </nav>
              <div className="space-y-3">
                {bucketInfo && <p className="text-sm text-muted-foreground">{bucketInfo.hint}</p>}
                {sectors.length > 1 && (
                  <nav aria-label="Filtrar por setor" className="flex flex-wrap gap-1.5">
                    <SectorChip href={hrefWith(surface.queue, { etapa, tag, ordem })} active={sectorId === undefined}>
                      Todos os setores · {items.length}
                    </SectorChip>
                    {sectors.map((chip) => (
                      <SectorChip key={chip.id} href={hrefWith(surface.queue, { etapa, setor: chip.id, tag, ordem })} active={chip.id === sectorId}>
                        {shortGroupName(chip.name)} · {chip.count}
                      </SectorChip>
                    ))}
                  </nav>
                )}
                {tagOptions.length > 0 && (
                  <nav aria-label="Filtrar por tag" className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Tag className="size-3" aria-hidden />
                      Tags:
                    </span>
                    <SectorChip href={hrefWith(surface.queue, { etapa, setor: sectorId, ordem })} active={tag === undefined}>
                      Todas
                    </SectorChip>
                    {tagOptions.map((option) => (
                      <SectorChip key={option.name} href={hrefWith(surface.queue, { etapa, setor: sectorId, tag: option.name, ordem })} active={option.name === tag}>
                        <span aria-hidden className={cn("me-1.5 size-1.5 rounded-full", FLOW_BADGE[option.color].dot)} />
                        {option.label} · {tagCount.get(option.name)}
                      </SectorChip>
                    ))}
                  </nav>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {filteredBy ? `${sorted.length} de ${items.length} ${items.length === 1 ? "chamado" : "chamados"}` : `${items.length} ${items.length === 1 ? "chamado" : "chamados"}`}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm" role="group" aria-label="Ordenar por">
                    <span className="text-muted-foreground">Ordenar:</span>
                    {SORTS.map((option) => (
                      <Link
                        key={option.key}
                        href={hrefWith(surface.queue, { etapa, setor: sectorId, tag, ordem: option.key === "idade" ? undefined : option.key })}
                        aria-current={option.key === sort ? "true" : undefined}
                        className={cn(
                          "rounded-full px-2.5 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          option.key === sort ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                        <LinkPending className="ms-1" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {sorted.length === 0 && !filteredBy && nothingPending && PENDING_BUCKETS.includes(bucket) ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
                    <Check className="size-6" aria-hidden />
                  </span>
                  <p className="text-base font-semibold text-foreground">Fila zerada</p>
                  <p className="text-sm text-muted-foreground">Nenhum pedido esperando decisão nos seus setores.</p>
                </div>
              ) : sorted.length === 0 ? (
                <EmptyState
                  icon={<Layers className="size-6" />}
                  title={`Nada em “${bucketInfo?.label ?? "esta etapa"}”`}
                  description={filteredBy ? "Nenhum chamado com esses filtros nesta etapa." : "Nenhum chamado nesta etapa agora."}
                  action={
                    filteredBy ? (
                      <Link href={hrefWith(surface.queue, { etapa, ordem })} className="text-sm font-medium text-primary hover:underline">
                        Limpar filtros
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ul className={LIST_CLASS}>
                    {sorted.slice(0, limit).map((ticket) => (
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
                  {sorted.length > limit && (
                    <div className="flex justify-center">
                      <Link
                        href={hrefWith(surface.queue, { etapa, setor: sectorId, tag, ordem, mais: limit + PAGE_SIZE })}
                        scroll={false}
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        Mostrar mais ({sorted.length - limit} {sorted.length - limit === 1 ? "restante" : "restantes"})
                        <LinkPending />
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()
      )}
    </ColaboraFrame>
  );
}
