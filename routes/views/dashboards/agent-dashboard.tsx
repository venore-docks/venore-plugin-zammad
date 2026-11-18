import { CircleCheck } from "lucide-react";
import { getAgentDashboardHandler } from "../../../features/get-agent-dashboard/handler";
import { surfaceFor } from "../../../shared/routes";
import { AgentTicketList } from "./agent/ticket-rows";
import type { DashboardProps } from "./types";

// Dashboard do agente: "Meu atendimento". Só o que está atribuído a ele (a fila é do gestor). Regra de design:
// os números numa frase (só "esperam sua resposta" com cor), listas com divisórias, sem cartão em volta.
export async function AgentDashboard({ surfaceKey }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const result = await getAgentDashboardHandler();
  const now = new Date();

  if (!result.success) {
    return (
      <section className="space-y-1" aria-label="Meu atendimento">
        <h2 className="text-lg font-semibold text-foreground">Meu atendimento</h2>
        <p className="text-sm text-muted-foreground">{result.error.message}</p>
      </section>
    );
  }

  const { stats, needsReply, inProgress } = result.data;
  const allDone = stats.open === 0;

  return (
    <section className="space-y-6" aria-label="Meu atendimento">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Meu atendimento</h2>
        <p className="text-sm text-muted-foreground">
          {allDone ? (
            "Nada com você agora."
          ) : (
            <>
              {stats.open} com você
              {stats.awaiting > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-warning">
                    {stats.awaiting} {stats.awaiting === 1 ? "espera" : "esperam"} sua resposta
                  </span>
                </>
              )}
              {stats.stale > 0 && ` · ${stats.stale} sem retorno há mais de 24 h`}
              {stats.urgent > 0 && ` · ${stats.urgent} ${stats.urgent === 1 ? "urgente" : "urgentes"}`}
            </>
          )}
        </p>
      </div>

      {allDone ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
          <CircleCheck className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium text-foreground">Tudo em dia</p>
          <p className="max-w-sm text-sm text-muted-foreground">Quando um chamado for atribuído a você, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {needsReply.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Precisam da sua resposta</h3>
              <AgentTicketList tickets={needsReply} hrefFor={surface.detail} now={now} label="Precisam da sua resposta" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguém esperando resposta sua.</p>
          )}
          {inProgress.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Em andamento</h3>
              <AgentTicketList tickets={inProgress} hrefFor={surface.detail} now={now} label="Em andamento" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
