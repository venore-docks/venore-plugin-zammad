import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Inbox, Layers, MessagesSquare, Users } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { EmptyState, cn } from "@venore/plugin-sdk/ui";
import { getAppViewer, getTeamOverview, listAgentTickets, listMyTickets } from "../../index";
import type { TicketSummary } from "../../index";
import { APP_BASE, APP_SURFACE } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { AppShell, type AppTab } from "./shell";

// /ext/zammad/app — início do app. A aba vem em ?aba=.
//   colaborador   Meus · Novo
//   agente        Atribuídos (só o que lhe foi dado) · Meus · Novo
//   gestor/admin  Fila (sem responsável — onde aloca) · Equipe (agentes e carga) · Atribuídos · Meus · Novo
const TAB_PARAM: Record<string, AppTab> = { atribuidos: "assigned", fila: "queue", equipe: "team", meus: "mine" };
const TITLES: Record<AppTab, string> = { assigned: "Atribuídos a mim", queue: "Fila", team: "Equipe", mine: "Meus chamados", new: "Novo chamado" };

type Who = { isStaff: boolean; isSupervisor: boolean };

function resolveTab(param: string | undefined, who: Who): AppTab {
  const tab = param ? TAB_PARAM[param] : undefined;
  if (tab === "mine") return tab;
  if (tab === "assigned" && who.isStaff) return tab;
  if ((tab === "queue" || tab === "team") && who.isSupervisor) return tab;
  if (who.isSupervisor) return "queue";
  return who.isStaff ? "assigned" : "mine";
}

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ aba?: string; agente?: string }> }) {
  if (!(await isPluginActive("zammad"))) notFound();
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect(`/login?callbackUrl=${encodeURIComponent(APP_BASE)}`);

  const viewer = await getAppViewer();
  if (!viewer.success) {
    return (
      <AppShell title="Chamados">
        <BlockedNotice title="Chamados" message={viewer.error.message} />
      </AppShell>
    );
  }
  const { isStaff, isSupervisor } = viewer.data;
  const query = await searchParams;
  const tab = resolveTab(query.aba, { isStaff, isSupervisor });
  const agentId = tab === "team" && isSupervisor && Number(query.agente) > 0 ? Number(query.agente) : null;

  const [assigned, queue, team, ofAgent, mine] = await Promise.all([
    isStaff ? listAgentTickets({ kind: "assigned" }) : null,
    isSupervisor ? listAgentTickets({ kind: "queue" }) : null,
    tab === "team" && isSupervisor && agentId === null ? getTeamOverview() : null,
    agentId !== null ? listAgentTickets({ kind: "of-agent", agentId }) : null,
    tab === "mine" ? listMyTickets() : null,
  ]);
  const counts = {
    assigned: assigned?.success ? assigned.data.tickets.length : 0,
    queue: queue?.success ? queue.data.tickets.length : 0,
  };
  const nav = { active: tab, isStaff, isSupervisor, counts };
  const hrefFor = APP_SURFACE.detail;

  // Aba Equipe > um agente: os chamados dele, com voltar para a equipe.
  if (agentId !== null) {
    const name = team?.success ? team.data.members.find((member) => member.id === agentId)?.name : undefined;
    return (
      <AppShell title={name ?? "Chamados do agente"} subtitle="Equipe" backHref={`${APP_BASE}?aba=equipe`} nav={nav}>
        {!ofAgent || !ofAgent.success ? (
          <BlockedNotice title="Equipe" message={ofAgent && !ofAgent.success ? ofAgent.error.message : "Não foi possível carregar."} />
        ) : ofAgent.data.tickets.length === 0 ? (
          <EmptyState icon={<Inbox className="size-6" />} title="Nenhum chamado em aberto" description="Esta pessoa não tem chamados atribuídos no momento." />
        ) : (
          <div className="space-y-6">
            <TicketGroup title="O solicitante respondeu" tickets={ofAgent.data.tickets.filter((t) => t.awaitingYou)} hrefFor={hrefFor} waiting showRequester />
            <TicketGroup title="Em andamento" tickets={ofAgent.data.tickets.filter((t) => !t.awaitingYou)} hrefFor={hrefFor} showRequester />
          </div>
        )}
      </AppShell>
    );
  }

  const current = tab === "assigned" ? assigned : tab === "queue" ? queue : tab === "team" ? team : mine;
  return (
    <AppShell title={TITLES[tab]} nav={nav}>
      {!current || !current.success ? (
        <BlockedNotice title={TITLES[tab]} message={current && !current.success ? current.error.message : "Não foi possível carregar."} />
      ) : tab === "team" && team?.success ? (
        <TeamContent overview={team.data} />
      ) : (
        <TabContent tab={tab} tickets={(current.data as { tickets: TicketSummary[] }).tickets} />
      )}
    </AppShell>
  );
}

function TeamContent({ overview }: { overview: { members: { id: number; name: string; open: number; waiting: number }[]; queue: number; groupCount: number } }) {
  return (
    <div className="space-y-4">
      <Link
        href={`${APP_BASE}?aba=fila`}
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50",
          overview.queue > 0 ? "border-warning-border bg-warning-soft" : "bg-card",
        )}
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold text-foreground">Sem responsável</span>
          <span className="block text-xs text-muted-foreground">{overview.queue === 0 ? "Nada esperando alocação." : "Abra a fila para atribuir a um agente."}</span>
        </span>
        <span className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          {overview.queue}
          <ChevronRight className="size-4 text-muted-foreground" />
        </span>
      </Link>

      {overview.members.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="Equipe não encontrada" description="Nenhum agente responde pelos setores que você gerencia no Zammad." />
      ) : (
        <ul className="space-y-2">
          {overview.members.map((member) => (
            <li key={member.id}>
              <Link
                href={`${APP_BASE}?aba=equipe&agente=${member.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-chart-6/20 text-xs font-semibold text-foreground">
                  {member.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{member.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {member.open} {member.open === 1 ? "chamado em aberto" : "chamados em aberto"}
                  </span>
                </span>
                {member.waiting > 0 && (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground">{member.waiting} aguardando</span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Mostra os chamados que o Zammad permite a você ver, nos {overview.groupCount === 1 ? "setor" : `${overview.groupCount} setores`} que você gerencia.</p>
    </div>
  );
}

function TabContent({ tab, tickets }: { tab: AppTab; tickets: TicketSummary[] }) {
  const hrefFor = APP_SURFACE.detail;
  if (tab === "assigned") {
    const waiting = tickets.filter((ticket) => ticket.awaitingYou);
    const rest = tickets.filter((ticket) => !ticket.awaitingYou);
    return tickets.length === 0 ? (
      <EmptyState icon={<Inbox className="size-6" />} title="Nada atribuído a você" description="Quando um chamado for atribuído a você, ele aparece aqui." />
    ) : (
      <div className="space-y-6">
        <TicketGroup title="O solicitante respondeu — sua vez" tickets={waiting} hrefFor={hrefFor} waiting showRequester />
        <TicketGroup title="Em andamento" tickets={rest} hrefFor={hrefFor} showRequester />
      </div>
    );
  }
  if (tab === "queue") {
    return tickets.length === 0 ? (
      <EmptyState icon={<Layers className="size-6" />} title="Fila vazia" description="Nenhum chamado sem responsável nos seus setores." />
    ) : (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Chamados sem responsável. Abra um e escolha quem vai atendê-lo.</p>
        <TicketGroup title="Sem responsável" tickets={tickets} hrefFor={hrefFor} showRequester />
      </div>
    );
  }
  // mine
  const waiting = tickets.filter((ticket) => ticket.awaitingYou);
  const active = tickets.filter((ticket) => !ticket.awaitingYou && !ticket.closed);
  const closed = tickets.filter((ticket) => ticket.closed);
  return tickets.length === 0 ? (
    <EmptyState icon={<MessagesSquare className="size-6" />} title="Nenhum chamado ainda" description="Toque em “Novo” para abrir um chamado — guiamos você pergunta por pergunta." />
  ) : (
    <div className="space-y-6">
      <TicketGroup title="A equipe respondeu — sua vez" tickets={waiting} hrefFor={hrefFor} waiting />
      <TicketGroup title="Em andamento" tickets={active} hrefFor={hrefFor} />
      <TicketGroup title="Encerrados" tickets={closed} hrefFor={hrefFor} muted />
    </div>
  );
}
