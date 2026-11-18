import Link from "next/link";
import { ArrowRight, BellRing, Plus } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { getCustomerDashboardHandler } from "../../../features/get-customer-dashboard/handler";
import type { CustomerDashboardData } from "../../../features/get-customer-dashboard/types";
import { surfaceFor } from "../../../shared/routes";
import { MineSummary, mineSentence } from "./customer/mine-summary";
import { SectorGrid } from "./customer/sector-grid";
import type { DashboardProps } from "./types";

type Surface = ReturnType<typeof surfaceFor>;

// Dashboard do colaborador (regra de design: o que espera a pessoa no topo; o chamado à ação é a própria lista
// de setores). Com `compact` (abaixo do painel de agente/gestor) vira uma linha no rodapé: o resumo dos pedidos
// da pessoa e o link para abrir um chamado.
export async function CustomerDashboard({ surfaceKey, compact = false }: DashboardProps) {
  const surface = surfaceFor(surfaceKey);
  const result = await getCustomerDashboardHandler();

  if (!result.success) {
    return (
      <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" aria-label="Meus chamados">
        {result.error.message}
      </section>
    );
  }
  const data = result.data;

  if (compact) return <CompactFooter data={data} surface={surface} />;

  return (
    <div className="space-y-8">
      <AwaitingNotice data={data} surface={surface} />
      {data.sectors.length > 0 ? (
        <SectorGrid sectors={data.sectors} newTicketHref={surface.newTicket} />
      ) : (
        <Button asChild>
          <Link href={surface.newTicket}>
            <Plus className="size-4" />
            Abrir chamado
          </Link>
        </Button>
      )}
      <MineSummary data={data} surface={surface} />
    </div>
  );
}

// Aviso no topo, só quando algo espera a pessoa. Com um único chamado, já diz qual e leva direto a ele.
function AwaitingNotice({ data, surface }: { data: CustomerDashboardData; surface: Surface }) {
  if (!data.ticketsOk || data.stats.awaitingYou === 0) return null;
  const only = data.stats.awaitingYou === 1 ? data.latest.find((ticket) => ticket.awaitingYou && !ticket.closed) : undefined;
  const href = only ? surface.detail(only.id) : `${surface.mine}?filtro=aguardando`;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-foreground transition-colors hover:bg-warning-soft/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <BellRing className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">
        {only ? (
          <>
            <strong className="font-semibold">Um chamado espera a sua resposta:</strong> {only.title}
          </>
        ) : (
          <strong className="font-semibold">{data.stats.awaitingYou} chamados esperam a sua resposta</strong>
        )}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
    </Link>
  );
}

function CompactFooter({ data, surface }: { data: CustomerDashboardData; surface: Surface }) {
  const sentence = data.ticketsOk && data.stats.total > 0 ? mineSentence(data.stats) : null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t pt-4 text-sm text-muted-foreground">
      {sentence && (
        <>
          <span>Seus pedidos: {sentence}.</span>
          <Link href={surface.mine} className="font-medium text-primary hover:underline">
            Ver meus chamados
          </Link>
          <span aria-hidden>·</span>
        </>
      )}
      <span>{sentence ? "Precisa de outro setor?" : "Precisa de ajuda de outro setor?"}</span>
      <Link href={surface.newTicket} className="font-medium text-primary hover:underline">
        Abrir um chamado
      </Link>
    </p>
  );
}
