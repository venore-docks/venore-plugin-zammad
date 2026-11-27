import Link from "next/link";
import { ChevronRight, ClipboardList, MessagesSquare, Search } from "lucide-react";
import type { CustomerDashboardData } from "../../../../features/get-customer-dashboard/types";
import type { CustomerStats } from "../../../../shared/customer-stats";
import { AwaitingBadge, LIST_CLASS, ROW_LINK_CLASS, StateBadge, formatDateTime } from "../../../public/shared";

type Surface = { mine: string; detail: (ticketId: number) => string };

// Os números dos pedidos da pessoa numa frase (regra de design: tile grande só quando o número é a decisão).
export function mineSentence(stats: CustomerStats): string {
  const parts = [`${stats.inProgress} em andamento`];
  if (stats.awaitingYou > 0) parts.push(`${stats.awaitingYou} ${stats.awaitingYou === 1 ? "aguarda" : "aguardam"} você`);
  // O total de encerrados fica em "Meus chamados"; aqui só o recorte recente (a legenda de lá explica a diferença).
  parts.push(`${stats.closedRecently} ${stats.closedRecently === 1 ? "encerrado" : "encerrados"} nos últimos 30 dias`);
  return parts.join(" · ");
}

// Resumo de "Meus chamados": a frase com os números + os últimos chamados; para quem nunca abriu, um mini-guia.
export function MineSummary({ data, surface }: { data: CustomerDashboardData; surface: Surface }) {
  const { stats, latest } = data;

  return (
    <section className="space-y-3" aria-labelledby="colabora-mine">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 space-y-1">
          <h2 id="colabora-mine" className="text-lg font-semibold tracking-tight text-foreground">
            Meus chamados
          </h2>
          {data.ticketsOk && stats.total > 0 && <p className="text-sm text-muted-foreground">{mineSentence(stats)}</p>}
        </div>
        {stats.total > 0 && (
          <Link href={surface.mine} className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Ver todos
          </Link>
        )}
      </div>

      {!data.ticketsOk ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Não conseguimos carregar os seus chamados agora. Tente de novo em instantes.</p>
      ) : stats.total === 0 ? (
        <FirstTimeGuide />
      ) : (
        <ul className={LIST_CLASS}>
          {latest.map((ticket) => (
            <li key={ticket.id}>
              <Link href={surface.detail(ticket.id)} className={ROW_LINK_CLASS}>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block truncate text-sm font-medium text-foreground">{ticket.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ticket.group} · {formatDateTime(ticket.updatedAt)}
                  </span>
                </span>
                {ticket.awaitingYou && !ticket.closed ? <AwaitingBadge /> : <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} color={ticket.stateColor} />}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const GUIDE_STEPS = [
  { icon: <Search aria-hidden className="size-4" />, title: "Escolha o setor", text: "Quem pode resolver o seu pedido." },
  { icon: <ClipboardList aria-hidden className="size-4" />, title: "Responda algumas perguntas", text: "Uma de cada vez, sem complicação." },
  { icon: <MessagesSquare aria-hidden className="size-4" />, title: "Acompanhe aqui", text: "Converse com a equipe e veja o andamento." },
];

function FirstTimeGuide() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">Você ainda não abriu nenhum chamado. É simples e leva poucos minutos:</p>
      <ol className="grid gap-3 sm:grid-cols-3">
        {GUIDE_STEPS.map((step, position) => (
          <li key={step.title} className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 text-muted-foreground">{step.icon}</span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium text-foreground">
                {position + 1}. {step.title}
              </span>
              <span className="block text-xs text-muted-foreground">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
