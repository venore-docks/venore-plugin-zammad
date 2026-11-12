import { Inbox } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { listAgentTickets } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";

// Atribuídos a mim: os chamados que o agente (ou gestor/admin) recebeu para atender. O agente comum só vê o que
// lhe foi atribuído — nunca a fila.
export async function AssignedView({ surfaceKey }: { surfaceKey: SurfaceKey }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.assigned);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="assigned" title="Atribuídos a mim">
        <BlockedNotice title="Atribuídos a mim" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;
  if (!viewer.isStaff) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={viewer} active="home" title="Atribuídos a mim">
        <BlockedNotice title="Área da equipe" message="Esta área é só para a equipe de atendimento." />
      </ColaboraFrame>
    );
  }

  const result = await listAgentTickets({ kind: "assigned" });
  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="assigned"
      title="Atribuídos a mim"
      subtitle="Chamados que estão com você para atender."
    >
      {!result.success ? (
        <BlockedNotice title="Atribuídos a mim" message={result.error.message} />
      ) : result.data.tickets.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="Nada atribuído a você" description="Quando um chamado for atribuído a você, ele aparece aqui." />
      ) : (
        <div className="space-y-6">
          <TicketGroup title="O solicitante respondeu — sua vez" tickets={result.data.tickets.filter((t) => t.awaitingYou)} hrefFor={surface.detail} waiting showRequester />
          <TicketGroup title="Em andamento" tickets={result.data.tickets.filter((t) => !t.awaitingYou)} hrefFor={surface.detail} showRequester />
        </div>
      )}
    </ColaboraFrame>
  );
}
