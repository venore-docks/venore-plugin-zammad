import { notFound, redirect } from "next/navigation";
import { Inbox, Layers, MessagesSquare } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { getAppViewer, listAgentTickets, listMyTickets } from "../../index";
import type { TicketSummary } from "../../index";
import { APP_BASE, APP_SURFACE } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketGroup } from "../public/ticket-list";
import { AppShell, type AppTab } from "./shell";

// /ext/zammad/app — início do app. Agente: abas "Atribuídos" (com ele), "Fila" (sem responsável, nos setores
// dele) e "Meus" (os que ele abriu). Colaborador comum: só "Meus" e "Novo". A aba vem em ?aba=.
const TAB_PARAM: Record<string, AppTab> = { atribuidos: "assigned", fila: "queue", meus: "mine" };
const TITLES: Record<AppTab, string> = { assigned: "Atribuídos a mim", queue: "Fila", mine: "Meus chamados", new: "Novo chamado" };

function resolveTab(param: string | undefined, isAgent: boolean): AppTab {
  const tab = param ? TAB_PARAM[param] : undefined;
  if (tab && (isAgent || tab === "mine")) return tab;
  return isAgent ? "assigned" : "mine";
}

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
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
  const { isAgent } = viewer.data;
  const { aba } = await searchParams;
  const tab = resolveTab(aba, isAgent);

  // Agente: as duas listas dele sempre (os números nas abas); "meus" só quando a aba é essa.
  const [assigned, queue, mine] = await Promise.all([
    isAgent ? listAgentTickets({ kind: "assigned" }) : null,
    isAgent ? listAgentTickets({ kind: "queue" }) : null,
    tab === "mine" ? listMyTickets() : null,
  ]);
  const counts = {
    assigned: assigned?.success ? assigned.data.tickets.length : 0,
    queue: queue?.success ? queue.data.tickets.length : 0,
  };
  const current = tab === "assigned" ? assigned : tab === "queue" ? queue : mine;

  return (
    <AppShell title={TITLES[tab]} nav={{ active: tab, isAgent, counts }}>
      {!current || !current.success ? (
        <BlockedNotice title={TITLES[tab]} message={current && !current.success ? current.error.message : "Não foi possível carregar."} />
      ) : (
        <TabContent tab={tab} tickets={current.data.tickets} />
      )}
    </AppShell>
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
        <p className="text-sm text-muted-foreground">Chamados sem responsável. Abra um e toque em “Assumir” para atendê-lo.</p>
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
