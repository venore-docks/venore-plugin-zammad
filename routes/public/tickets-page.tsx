import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BellRing, ChevronRight, LifeBuoy, Plus } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { Button, EmptyState, cn } from "@venore/plugin-sdk/ui";
import { listMyTickets } from "../../index";
import type { TicketSummary } from "../../index";
import { BlockedNotice, StateBadge, formatDateTime, toneBar } from "./shared";

// /chamados — os chamados que a pessoa abriu, separados por "o que precisa de você": primeiro os que
// a equipe respondeu, depois os em andamento e, por último, os encerrados. Cada linha abre a conversa
// aqui mesmo; o Zammad não aparece para o colaborador.
export default async function TicketsPage() {
  if (!(await isPluginActive("zammad"))) notFound();
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect("/login?callbackUrl=%2Fchamados");

  const result = await listMyTickets();
  if (!result.success) {
    return (
      <div className="py-10">
        <BlockedNotice title="Chamados" message={result.error.message} />
      </div>
    );
  }
  const { tickets } = result.data;
  const waiting = tickets.filter((ticket) => ticket.awaitingYou);
  const active = tickets.filter((ticket) => !ticket.awaitingYou && !ticket.closed);
  const closed = tickets.filter((ticket) => ticket.closed);

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/10 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meus chamados</h1>
          <p className="text-sm text-foreground/80">Acompanhe os seus pedidos e converse com a equipe de cada setor.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/chamados/novo">
            <Plus className="size-4" />
            Abrir chamado
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="size-6" />}
          title="Nenhum chamado ainda"
          description="Quando precisar de algo de um setor, abra um chamado — guiamos você pergunta por pergunta."
        />
      ) : (
        <div className="space-y-8">
          <TicketGroup title="A equipe respondeu — sua vez" tone="waiting" tickets={waiting} />
          <TicketGroup title="Em andamento" tickets={active} />
          <TicketGroup title="Encerrados" tickets={closed} muted />
        </div>
      )}
    </div>
  );
}

function TicketGroup({ title, tickets, tone, muted = false }: { title: string; tickets: TicketSummary[]; tone?: "waiting"; muted?: boolean }) {
  if (tickets.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className={cn("flex items-center gap-2 text-sm font-semibold", tone === "waiting" ? "text-warning" : "text-foreground", muted && "text-muted-foreground")}>
        {tone === "waiting" && <BellRing className="size-4" />}
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{tickets.length}</span>
      </h2>
      <ul className="space-y-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/chamados/${ticket.id}`}
              className={cn(
                "group flex items-center gap-4 overflow-hidden rounded-xl border bg-card pe-4 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tone === "waiting" && "border-warning-border bg-warning-soft",
                muted && "opacity-80",
              )}
            >
              <span aria-hidden className={cn("w-1.5 self-stretch", tone === "waiting" ? "bg-warning" : toneBar(ticket.stateTone))} />
              <span className="min-w-0 flex-1 space-y-1 py-3.5">
                <span className="block truncate font-medium text-foreground">{ticket.title}</span>
                <span className="block text-xs text-muted-foreground">
                  #{ticket.number} · {ticket.group} · atualizado em {formatDateTime(ticket.updatedAt)}
                </span>
              </span>
              <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
