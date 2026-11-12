import { computeCustomerStats, latestTickets } from "../../shared/customer-stats";
import type { Requester } from "../../shared/requester";
import { getWizard } from "../get-wizard/service";
import { listMyTickets } from "../list-my-tickets/service";
import type { GetCustomerDashboardResult } from "./types";

const LATEST = 5;

// Uma ida ao Zammad para os chamados + a montagem do wizard (setores), em paralelo. Se os chamados falham, o
// painel ainda mostra os setores (e avisa); se o wizard falha, o painel mostra só o resumo.
export async function getCustomerDashboard(requester: Requester): Promise<GetCustomerDashboardResult> {
  const [mine, wizard] = await Promise.all([listMyTickets(requester), getWizard(requester)]);
  if (!mine.success && !wizard.success) return mine;

  const tickets = mine.success ? mine.data.tickets : [];
  const sectors = wizard.success ? wizard.data.sectors.filter((sector) => sector.parentId === null) : [];

  return {
    success: true,
    data: {
      sectors,
      stats: computeCustomerStats(tickets, Date.now()),
      latest: latestTickets(tickets, LATEST),
      ticketsOk: mine.success,
    },
  };
}
