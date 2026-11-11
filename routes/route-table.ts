import { asPluginPage, type PluginRouteTable } from "@venore/plugin-sdk";
import AdminPage from "./admin/page";
import { getTicketAttachment } from "./api/attachment";
import NewTicketPage from "./public/new-ticket-page";
import TicketDetailPage from "./public/ticket-detail-page";
import TicketsPage from "./public/tickets-page";

export const zammadRouteTable: PluginRouteTable = {
  admin: [{ pattern: "", Component: asPluginPage(AdminPage) }],
  // `public` é caminho completo. Primeiro match vence: "novo" ANTES de ":ticketId".
  public: [
    { pattern: "chamados", Component: asPluginPage(TicketsPage) },
    { pattern: "chamados/novo", Component: asPluginPage(NewTicketPage) },
    { pattern: "chamados/:ticketId", Component: asPluginPage(TicketDetailPage) },
  ],
  api: [
    {
      pattern: "tickets/:ticketId/articles/:articleId/attachments/:attachmentId",
      handlers: { GET: getTicketAttachment },
    },
  ],
};
