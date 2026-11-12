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

  if (result.data.sectors.length === 0) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={entered.viewer} active="new" title="Abrir chamado" backHref={surface.home}>
        <div className="mx-auto max-w-xl space-y-2 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">Nenhum setor está liberado para você ainda</h2>
          <p className="text-sm text-muted-foreground">Fale com o gestor da sua área para pedir acesso.</p>
        </div>
      </ColaboraFrame>
    );
  }

  const requested = Number(setor);
  const initialGroupId = Number.isInteger(requested) && result.data.sectors.some((sector) => sector.groupId === requested) ? requested : null;
  // Link direto para um setor que não está liberado para a pessoa: avisa e mostra os que estão.
  const unavailable = setor !== undefined && setor !== "" && initialGroupId === null;

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={entered.viewer}
      active="new"
      title="Abrir chamado"
      subtitle="Vamos guiar você, uma pergunta por vez. Leva poucos minutos."
      backHref={surfaceKey === "app" ? surface.home : undefined}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {unavailable && (
          <p role="status" className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-foreground">
            O setor do link não está disponível para você. Escolha abaixo um dos setores liberados.
          </p>
        )}
        <TicketWizard data={result.data} initialGroupId={initialGroupId} surface={surfaceKey} />
      </div>
    </ColaboraFrame>
  );
}
