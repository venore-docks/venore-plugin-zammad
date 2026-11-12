import type { AppViewer } from "../../../index";
import type { SurfaceKey } from "../../../shared/routes";

// Contrato dos dashboards por papel (renderizados dentro de DashboardView, já dentro da moldura da superfície).
//   CustomerDashboard  o dashboard do colaborador; com `compact`, a versão enxuta exibida abaixo do dashboard de
//                      agente/gestor (eles também são colaboradores e abrem chamados).
//   AgentDashboard     o dashboard de quem atende (só o que lhe foi atribuído).
//   ManagerDashboard   o dashboard do gestor/admin (fila, equipe, carga, alocação).
export type DashboardProps = {
  surfaceKey: SurfaceKey;
  viewer: AppViewer;
  /** Versão enxuta (usada quando o dashboard do papel já ocupa o topo da página). */
  compact?: boolean;
};
