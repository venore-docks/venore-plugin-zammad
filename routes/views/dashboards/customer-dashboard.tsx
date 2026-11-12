import Link from "next/link";
import { MessagesSquare, Plus } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { listMyTickets } from "../../../index";
import { surfaceFor } from "../../../shared/routes";
import type { DashboardProps } from "./types";

// Dashboard do colaborador. (Versão de base: a frente "colaborador" a aprimora — ver DashboardProps.)
export async function CustomerDashboard({ surfaceKey, compact = false }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const mine = await listMyTickets();
  const tickets = mine.success ? mine.data.tickets : [];
  const open = tickets.filter((ticket) => !ticket.closed).length;
  const waiting = tickets.filter((ticket) => ticket.awaitingYou).length;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Meus chamados">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{compact ? "Meus pedidos" : "O que você precisa?"}</h2>
          <p className="text-sm text-muted-foreground">
            {open} em andamento{waiting > 0 ? ` · ${waiting} aguardando você` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href={surface.newTicket}>
              <Plus className="size-4" />
              Abrir chamado
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={surface.mine}>
              <MessagesSquare className="size-4" />
              Meus chamados
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
