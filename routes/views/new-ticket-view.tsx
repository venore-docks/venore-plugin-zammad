import { getWizard } from "../../index";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketWizard } from "../public/ticket-wizard";
import { enterSurface } from "./context";
import { ColaboraFrame } from "./frame";

// Abrir chamado: o passo a passo guiado. `?setor=<id do grupo no Zammad>` já começa no setor (links diretos de
// outras páginas, ex.: "Pedir material ao Marketing"). Só os setores que a pessoa pode acionar chegam aqui.
export async function NewTicketView({ surfaceKey, setor }: { surfaceKey: SurfaceKey; setor?: string }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.newTicket);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="new" title="Abrir chamado" backHref={surface.home}>
        <BlockedNotice title="Abrir chamado" message={entered.message} />
      </ColaboraFrame>
    );
  }

  const result = await getWizard();
  if (!result.success) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={entered.viewer} active="new" title="Abrir chamado" backHref={surface.home}>
        <BlockedNotice title="Abrir chamado" message={result.error.message} />
      </ColaboraFrame>
    );
  }

  const requested = Number(setor);
  const initialGroupId = Number.isInteger(requested) && result.data.sectors.some((sector) => sector.groupId === requested) ? requested : null;

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={entered.viewer}
      active="new"
      title="Abrir chamado"
      subtitle="Vamos guiar você, uma pergunta por vez. Leva poucos minutos."
      backHref={surfaceKey === "app" ? surface.home : undefined}
    >
      <div className="mx-auto max-w-3xl">
        <TicketWizard data={result.data} initialGroupId={initialGroupId} surface={surfaceKey} />
      </div>
    </ColaboraFrame>
  );
}
