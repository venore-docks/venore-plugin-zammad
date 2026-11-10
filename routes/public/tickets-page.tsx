import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, LifeBuoy, Plus } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { Button, EmptyState } from "@venore/plugin-sdk/ui";
import { listMyTickets } from "../../index";
import { BlockedNotice, StateBadge, formatDateTime } from "./shared";

// /chamados — os chamados que a pessoa abriu (abertos primeiro pela data de atualização) e o botão
// para abrir um novo. Exige login: as contas do portal são as mesmas do Zammad.
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meus chamados</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os pedidos que você abriu para os setores.</p>
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
          description="Quando precisar de algo de um setor, abra um chamado — vamos te guiar pergunta por pergunta."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-foreground">{ticket.title}</p>
                <p className="text-xs text-muted-foreground">
                  #{ticket.number} · {ticket.group} · atualizado em {formatDateTime(ticket.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
                <Button variant="ghost" size="sm" asChild>
                  <a href={ticket.url} target="_blank" rel="noreferrer">
                    Abrir no Zammad
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
