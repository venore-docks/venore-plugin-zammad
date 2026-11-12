import { Suspense } from "react";
import type { AgentControls } from "../../contracts/types";
import { getTeamLoadsHandler } from "../../features/get-manager-dashboard/handler";
import { pickLeastLoaded } from "../../shared/manager-stats";
import { AllocationForm } from "./dashboards/manager/allocation-form";

// ALOCAÇÃO (gestor/admin): atribuir o chamado a um agente do setor, realocar ou devolver à fila. O agente comum
// NUNCA vê isto — quem aloca é o gestor (a regra também é aplicada no servidor, em agent-update-ticket).
// Componente de servidor: o formulário é cliente (allocation-form) e a dica do menos carregado chega em Suspense.
export function AllocationControls({ ticketId, controls }: { ticketId: number; controls: AgentControls }) {
  if (!controls.canAllocate) return null;
  return (
    <AllocationForm ticketId={ticketId} controls={controls}>
      <Suspense fallback={null}>
        <LeastLoadedHint controls={controls} />
      </Suspense>
    </AllocationForm>
  );
}

// "Menos carregado": só informa (a escolha é do gestor) e só quando há dado; qualquer falha some em silêncio.
async function LeastLoadedHint({ controls }: { controls: AgentControls }) {
  const loads = await getTeamLoadsHandler();
  if (!loads.success) return null;
  const candidates = controls.assignees
    .filter((person) => person.id !== controls.ownerId)
    .flatMap((person) => {
      const load = loads.data[person.id];
      return load ? [{ id: person.id, name: person.name, open: load.open, waiting: load.waiting }] : [];
    });
  const best = pickLeastLoaded(candidates);
  if (!best) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Menos carregado neste setor: <strong className="font-medium text-foreground">{best.name}</strong> ({best.open} {best.open === 1 ? "aberto" : "abertos"})
    </p>
  );
}
