import { isPluginActive } from "@venore/plugin-sdk";
import { TicketProperties } from "./ticket-properties";
import { loadTicketForView, loadViewerForView } from "./ticket-data";

// Barra contextual de /colabora/chamado/:id (área `sidebarContextual`): as propriedades do chamado no desktop.
// Abaixo de lg o tema poria a barra embaixo do conteúdo; lá as propriedades já estão empilhadas acima da
// conversa (ticket-view.tsx), então aqui elas só aparecem a partir de lg. Erro/sem acesso = nada (a página
// principal mostra o aviso).
export async function TicketSidebar({ params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await isPluginActive("colabora"))) return null;
  const { ticketId } = await params;
  const id = Number(ticketId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [result, viewer] = await Promise.all([loadTicketForView(id), loadViewerForView()]);
  if (!result.success || !viewer.success) return null;
  return (
    <div className="hidden lg:block">
      <TicketProperties ticket={result.data} surfaceKey="portal" readOnly={Boolean(viewer.data.viewingAs)} />
    </div>
  );
}
