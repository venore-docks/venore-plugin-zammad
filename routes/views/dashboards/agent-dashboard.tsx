import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { listAgentTickets } from "../../../index";
import { surfaceFor } from "../../../shared/routes";
import type { DashboardProps } from "./types";

// Dashboard do agente. (Versão de base: a frente "agente" a aprimora — ver DashboardProps.)
export async function AgentDashboard({ surfaceKey }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const assigned = await listAgentTickets({ kind: "assigned" });
  const tickets = assigned.success ? assigned.data.tickets : [];
  const waiting = tickets.filter((ticket) => ticket.awaitingYou).length;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Atendimento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Meu atendimento</h2>
          <p className="text-sm text-muted-foreground">
            {tickets.length} atribuídos{waiting > 0 ? ` · ${waiting} aguardando sua resposta` : ""}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={surface.assigned}>
            <Inbox className="size-4" />
            Atribuídos a mim
          </Link>
        </Button>
      </div>
    </section>
  );
}
