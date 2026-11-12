import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { enterSurface } from "./context";
import { AgentDashboard } from "./dashboards/agent-dashboard";
import { CustomerDashboard } from "./dashboards/customer-dashboard";
import { ManagerDashboard } from "./dashboards/manager-dashboard";
import { ColaboraFrame } from "./frame";

// Início do Colabora: o dashboard do papel de quem entrou.
//   colaborador  → dashboard do colaborador (abrir chamado em destaque, meus chamados)
//   agente       → dashboard do agente, e o do colaborador (enxuto) abaixo
//   gestor/admin → dashboard do gestor, e o do colaborador (enxuto) abaixo
// Agentes e gestores também são colaboradores (têm a permissão de colaborador), então sempre podem abrir chamado.
export async function DashboardView({ surfaceKey }: { surfaceKey: SurfaceKey }) {
  const surface = surfaceFor(surfaceKey);
  const entered = await enterSurface(surface.home);
  if (!entered.ok) {
    return (
      <ColaboraFrame surfaceKey={surfaceKey} viewer={null} active="home" title="Colabora">
        <BlockedNotice title="Colabora" message={entered.message} />
      </ColaboraFrame>
    );
  }
  const { viewer } = entered;
  const firstName = viewer.name.trim().split(/\s+/)[0] || "colaborador";

  return (
    <ColaboraFrame
      surfaceKey={surfaceKey}
      viewer={viewer}
      active="home"
      title={`Olá, ${firstName}`}
      subtitle={viewer.isSupervisor ? "Visão do gestor" : viewer.isStaff ? "Visão do atendimento" : "Como podemos ajudar hoje?"}
    >
      <div className="space-y-6">
        {viewer.isSupervisor ? (
          <>
            <ManagerDashboard surfaceKey={surfaceKey} viewer={viewer} />
            <CustomerDashboard surfaceKey={surfaceKey} viewer={viewer} compact />
          </>
        ) : viewer.isStaff ? (
          <>
            <AgentDashboard surfaceKey={surfaceKey} viewer={viewer} />
            <CustomerDashboard surfaceKey={surfaceKey} viewer={viewer} compact />
          </>
        ) : (
          <CustomerDashboard surfaceKey={surfaceKey} viewer={viewer} />
        )}
      </div>
    </ColaboraFrame>
  );
}
