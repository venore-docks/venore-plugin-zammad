import "server-only";
import { cache } from "react";
import { getAppViewer, getTicket } from "../../index";

// A página do chamado e a barra contextual dela são renderizadas na MESMA requisição: com `cache` o chamado
// (e quem vê) é lido do Zammad uma vez só, e as duas regiões mostram o mesmo estado.
export const loadTicketForView = cache((ticketId: number) => getTicket({ ticketId, asAgent: true }));
export const loadViewerForView = cache(() => getAppViewer());
