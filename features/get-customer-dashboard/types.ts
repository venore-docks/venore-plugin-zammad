import type { OperationResult } from "@venore/plugin-sdk";
import type { SectorForm, TicketSummary } from "../../contracts/types";
import type { CustomerStats } from "../../shared/customer-stats";

export type CustomerDashboardData = {
  /** Só os setores raiz que a pessoa pode acionar, na ordem em que vieram. */
  sectors: SectorForm[];
  stats: CustomerStats;
  latest: TicketSummary[];
  /** false se a lista de chamados falhou (o restante do painel ainda aparece). */
  ticketsOk: boolean;
};

export type GetCustomerDashboardResult = OperationResult<CustomerDashboardData>;
