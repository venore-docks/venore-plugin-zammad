import { requesterIsColaboraAdmin, resolveRequester } from "../../shared/requester";
import { loadAudienceViewer } from "../../shared/wizard-config";
import { getCustomerDashboard } from "./service";
import type { GetCustomerDashboardResult } from "./types";

// Os setores do painel seguem a audiência de quem pede (mesma regra do "Abrir chamado").
export async function getCustomerDashboardHandler(): Promise<GetCustomerDashboardResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  const viewer = await loadAudienceViewer(requester.data.actorId, await requesterIsColaboraAdmin(requester.data));
  return getCustomerDashboard(requester.data, viewer);
}