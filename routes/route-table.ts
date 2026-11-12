import { asPluginMetadata, asPluginPage, type PluginRouteTable } from "@venore/plugin-sdk";
import AdminPage from "./admin/page";
import AdminAppPage from "./admin/app/page";
import AdminGroupPage from "./admin/grupos/detalhe-page";
import AdminGroupsPage from "./admin/grupos/page";
import AdminSectorEditPage from "./admin/setores/editar-page";
import AdminSectorsPage from "./admin/setores/page";
import AdminTextsPage from "./admin/textos/page";
import { getAppIcon } from "./api/app-icon";
import { getAppManifest } from "./api/app-manifest";
import { getTicketAttachment } from "./api/attachment";
import { appMetadata } from "./app/metadata";
import { appEntries, portalEntries } from "./entries";
import { legacyApp, legacyPortal } from "./legacy";

// Cada tela existe nas DUAS superfícies, com o mesmo desenho de caminho:
//   portal /colabora/…           dentro da casca do Venore Docks (área `public`, caminho completo)
//   app    /ext/colabora/app/…   PWA própria, sem a casca (área `standalone`, servida pelo dispatcher /ext)
// Primeiro match vence: segmentos fixos antes de `:param`.
const app = { generateMetadata: asPluginMetadata(appMetadata) };

export const colaboraRouteTable: PluginRouteTable = {
  admin: [
    { pattern: "", Component: asPluginPage(AdminPage) },
    { pattern: "setores", Component: asPluginPage(AdminSectorsPage) },
    { pattern: "setores/:groupId", Component: asPluginPage(AdminSectorEditPage) },
    { pattern: "grupos", Component: asPluginPage(AdminGroupsPage) },
    { pattern: "grupos/:groupId", Component: asPluginPage(AdminGroupPage) },
    { pattern: "app", Component: asPluginPage(AdminAppPage) },
    { pattern: "textos", Component: asPluginPage(AdminTextsPage) },
  ],
  public: [
    { pattern: "colabora", Component: asPluginPage(portalEntries.Home) },
    { pattern: "colabora/meus", Component: asPluginPage(portalEntries.Mine) },
    { pattern: "colabora/novo", Component: asPluginPage(portalEntries.New) },
    { pattern: "colabora/atribuidos", Component: asPluginPage(portalEntries.Assigned) },
    { pattern: "colabora/fila", Component: asPluginPage(portalEntries.Queue) },
    { pattern: "colabora/equipe", Component: asPluginPage(portalEntries.Team) },
    { pattern: "colabora/equipe/:agentId", Component: asPluginPage(portalEntries.TeamAgent) },
    { pattern: "colabora/chamado/:ticketId", Component: asPluginPage(portalEntries.Ticket) },
    // Endereços antigos (/chamados…): redirecionam.
    { pattern: "chamados", Component: asPluginPage(legacyPortal.Home) },
    { pattern: "chamados/novo", Component: asPluginPage(legacyPortal.New) },
    { pattern: "chamados/:ticketId", Component: asPluginPage(legacyPortal.Ticket) },
  ],
  standalone: [
    { pattern: "colabora/app", Component: asPluginPage(appEntries.Home), ...app },
    { pattern: "colabora/app/meus", Component: asPluginPage(appEntries.Mine), ...app },
    { pattern: "colabora/app/novo", Component: asPluginPage(appEntries.New), ...app },
    { pattern: "colabora/app/atribuidos", Component: asPluginPage(appEntries.Assigned), ...app },
    { pattern: "colabora/app/fila", Component: asPluginPage(appEntries.Queue), ...app },
    { pattern: "colabora/app/equipe", Component: asPluginPage(appEntries.Team), ...app },
    { pattern: "colabora/app/equipe/:agentId", Component: asPluginPage(appEntries.TeamAgent), ...app },
    { pattern: "colabora/app/chamado/:ticketId", Component: asPluginPage(appEntries.Ticket), ...app },
    // App instalado antes do Colabora (start_url /ext/zammad/app): redireciona.
    { pattern: "zammad/app", Component: asPluginPage(legacyApp.Home) },
    { pattern: "zammad/app/novo", Component: asPluginPage(legacyApp.New) },
    { pattern: "zammad/app/chamado/:ticketId", Component: asPluginPage(legacyApp.Ticket) },
  ],
  api: [
    {
      pattern: "tickets/:ticketId/articles/:articleId/attachments/:attachmentId",
      handlers: { GET: getTicketAttachment },
    },
    // Público (o navegador busca o manifest e o ícone sem cookies).
    { pattern: "app/manifest", handlers: { GET: getAppManifest } },
    { pattern: "app/icon", handlers: { GET: getAppIcon } },
  ],
};
