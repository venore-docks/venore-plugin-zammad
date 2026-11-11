import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LifeBuoy, Plus } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { Button, EmptyState } from "@venore/plugin-sdk/ui";
import { listMyTickets } from "../../index";
import { PORTAL_SURFACE } from "../../shared/routes";
import { BlockedNotice } from "./shared";
import { TicketGroup } from "./ticket-list";

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
          <Link href={PORTAL_SURFACE.newTicket}>
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
          <TicketGroup title="A equipe respondeu — sua vez" tickets={waiting} hrefFor={PORTAL_SURFACE.detail} waiting />
          <TicketGroup title="Em andamento" tickets={active} hrefFor={PORTAL_SURFACE.detail} />
          <TicketGroup title="Encerrados" tickets={closed} hrefFor={PORTAL_SURFACE.detail} muted />
        </div>
      )}
    </div>
  );
}
