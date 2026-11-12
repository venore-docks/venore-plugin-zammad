import { Layers } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { listAgentTickets } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";
import type { ViewQuery } from "./query";

// Fila: chamados sem responsável, nos setores do gestor/admin. É de onde ele aloca. O agente comum NÃO vê a fila.
export async function QueueView({ surfaceKey }: { surfaceKey: SurfaceKey; query?: ViewQuery }) {
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

  const result = await listAgentTickets({ kind: "queue" });
  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="queue"
      title="Fila"
      subtitle="Chamados sem responsável. Abra um e escolha quem vai atendê-lo."
      counts={result.success ? { queue: result.data.tickets.length } : undefined}
    >
      {!result.success ? (
        <BlockedNotice title="Fila" message={result.error.message} />
      ) : result.data.tickets.length === 0 ? (
        <EmptyState icon={<Layers className="size-6" />} title="Fila vazia" description="Nenhum chamado sem responsável nos seus setores." />
      ) : (
        <TicketGroup title="Sem responsável" tickets={result.data.tickets} hrefFor={surface.detail} showRequester />
      )}
    </ColaboraFrame>
  );
}
