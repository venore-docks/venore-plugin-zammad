import { asPluginMetadata, asPluginPage, type PluginRouteTable } from "@venore/plugin-sdk";
import AdminPage from "./admin/page";
import AppHomePage from "./app/home-page";
import { appMetadata } from "./app/metadata";
import AppNewTicketPage from "./app/new-page";
import AppTicketPage from "./app/ticket-page";
import { getAppIcon } from "./api/app-icon";
import { getAppManifest } from "./api/app-manifest";
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
  // O APP (PWA): fora da casca do Venore Docks, servido pelo dispatcher /ext → /ext/zammad/app…
  // `generateMetadata` aponta cada página para o manifest próprio do app.
  standalone: [
    { pattern: "zammad/app", Component: asPluginPage(AppHomePage), generateMetadata: asPluginMetadata(appMetadata) },
    { pattern: "zammad/app/novo", Component: asPluginPage(AppNewTicketPage), generateMetadata: asPluginMetadata(appMetadata) },
    { pattern: "zammad/app/chamado/:ticketId", Component: asPluginPage(AppTicketPage), generateMetadata: asPluginMetadata(appMetadata) },
  ],
  api: [
    {
      pattern: "tickets/:ticketId/articles/:articleId/attachments/:attachmentId",
      handlers: { GET: getTicketAttachment },
    },
    // Público (o navegador busca o manifest sem cookies).
    { pattern: "app/manifest", handlers: { GET: getAppManifest } },
    // Ícone do app = favicon do site em PNG (192/512/180). Também público.
    { pattern: "app/icon", handlers: { GET: getAppIcon } },
  ],
};
