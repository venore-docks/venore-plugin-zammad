import Link from "next/link";
import { ArrowRight, BellRing, CircleCheck, ClipboardList, Hourglass, MessagesSquare, Search } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { CustomerDashboardData } from "../../../../features/get-customer-dashboard/types";
import { StateBadge, formatDateTime, toneBar } from "../../../public/shared";

type Surface = { mine: string; detail: (ticketId: number) => string };

function Tile({ label, value, icon, href, highlight = false }: { label: string; value: number; icon: React.ReactNode; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        highlight && "border-warning-border bg-warning-soft",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-xs font-medium text-muted-foreground", highlight && "text-warning")}>
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
    </Link>
  );
}

// Resumo de "Meus chamados": três números + os últimos chamados; para quem nunca abriu, um mini-guia.
export function MineSummary({ data, surface, compact }: { data: CustomerDashboardData; surface: Surface; compact: boolean }) {
  const { stats, latest } = data;
  const filtered = (filtro: string) => `${surface.mine}?filtro=${filtro}`;

  return (
    <section className="space-y-4" aria-labelledby="colabora-mine">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="colabora-mine" className="text-lg font-semibold tracking-tight text-foreground">
          Meus chamados
        </h2>
        {stats.total > 0 && (
          <Link href={surface.mine} className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Ver todos
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>

      {!data.ticketsOk ? (
        <p className="rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-foreground">
          Não conseguimos carregar os seus chamados agora. Tente de novo em instantes.
        </p>
      ) : stats.total === 0 ? (
        compact ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Você ainda não abriu nenhum chamado.</p>
        ) : (
          <FirstTimeGuide />
        )
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Em andamento" value={stats.inProgress} icon={<Hourglass aria-hidden className="size-3.5 shrink-0" />} href={filtered("andamento")} />
            <Tile
              label="Aguardando você"
              value={stats.awaitingYou}
              icon={<BellRing aria-hidden className="size-3.5 shrink-0" />}
              href={filtered("aguardando")}
              highlight={stats.awaitingYou > 0}
            />
            <Tile label="Encerrados (30 dias)" value={stats.closedRecently} icon={<CircleCheck aria-hidden className="size-3.5 shrink-0" />} href={filtered("encerrados")} />
          </div>

          <ul className="space-y-2">
            {latest.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={surface.detail(ticket.id)}
                  className="group flex items-center gap-3 overflow-hidden rounded-xl border bg-card pe-3 transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span aria-hidden className={cn("w-1.5 self-stretch", ticket.awaitingYou && !ticket.closed ? "bg-warning" : toneBar(ticket.stateTone))} />
                  <span className="min-w-0 flex-1 space-y-1 py-3">
                    <span className="block truncate font-medium text-foreground">{ticket.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ticket.group} · {formatDateTime(ticket.updatedAt)}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <StateBadge label={ticket.stateLabel} tone={ticket.stateTone} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const GUIDE_STEPS = [
  { icon: <Search aria-hidden className="size-5" />, title: "Escolha o setor", text: "Quem pode resolver o seu pedido." },
  { icon: <ClipboardList aria-hidden className="size-5" />, title: "Responda algumas perguntas", text: "Uma de cada vez, sem complicação." },
  { icon: <MessagesSquare aria-hidden className="size-5" />, title: "Acompanhe aqui", text: "Converse com a equipe e veja o andamento." },
];

function FirstTimeGuide() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <p className="font-medium text-foreground">Você ainda não abriu nenhum chamado</p>
        <p className="text-sm text-muted-foreground">É simples e leva poucos minutos:</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {GUIDE_STEPS.map((step, position) => (
          <li key={step.title} className="flex min-w-0 items-start gap-3 rounded-lg bg-muted/40 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{step.icon}</span>
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
