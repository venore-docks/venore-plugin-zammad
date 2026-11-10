import { asPluginPage, type PluginRouteTable } from "@venore/plugin-sdk";
import AdminPage from "./admin/page";
import NewTicketPage from "./public/new-ticket-page";
import TicketsPage from "./public/tickets-page";

export const zammadRouteTable: PluginRouteTable = {
  admin: [{ pattern: "", Component: asPluginPage(AdminPage) }],
  // `public` é caminho completo.
  public: [
    { pattern: "chamados", Component: asPluginPage(TicketsPage) },
    { pattern: "chamados/novo", Component: asPluginPage(NewTicketPage) },
  ],
};
