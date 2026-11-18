import Link from "next/link";
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { Button, Card, CardContent } from "@venore/plugin-sdk/ui";
import { getAdminOverviewHandler } from "../../features/admin-overview/handler";
import { ADMIN_BASE, MAX_HINTS, buildHints, type AdminHint } from "../../shared/admin-hints";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "./admin-shell";
import { ReloadSchemaButton } from "./overview-tools";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

// Rótulo do botão de cada próximo passo, pelo destino.
function hintAction(href: string): string {
  if (href.startsWith(`${ADMIN_BASE}/setores/`)) return "Configurar setor";
  if (href.startsWith(`${ADMIN_BASE}/grupos/`)) return "Abrir grupo";
  if (href === `${ADMIN_BASE}/grupos`) return "Criar grupo";
  if (href === `${ADMIN_BASE}/app`) return "Nomear o app";
  return "Ver";
}

// Visão geral do admin (regra de design do core, `.claude/rules/ui-design.md`): "Próximos passos" primeiro (é o
// que guia o admin), os números numa frase, a conexão numa linha quando está saudável (detalhes recolhidos) e
// em cartão no topo quando não está. Sem atalhos: as abas do admin já levam a cada seção.
export default async function ColaboraAdminOverviewPage() {
  const denied = await guardAdmin();
  if (denied) return denied;

  const result = await getAdminOverviewHandler({ level: "full" });
  if (!result.success) return <LoadError message={result.error.message} />;
  const overview = result.data;
  const { connection } = overview;

  const activeSectors = overview.sectors.filter((sector) => sector.config.enabled);
  const hints = buildHints({
    connection: connection.configured ? { configured: true, error: connection.error } : { configured: false },
    sectors: overview.sectors.map((sector) => ({
      groupId: sector.groupId,
      name: sector.config.label || sector.zammadName,
      enabled: sector.config.enabled,
      fieldCount: sector.fields.length,
      audienceKind: sector.audience.kind,
    })),
    peopleGroups: overview.peopleGroups.map((group) => ({ id: group.id, name: group.name, memberCount: group.memberCount, sectorCount: group.sectorIds.length })),
    appName: overview.appName,
    unsupportedCount: overview.unsupported.length,
  });
  // A conexão e as regras não suportadas têm bloco próprio: não repetem nos próximos passos.
  const steps = hints.filter((hint) => hint.id !== "no-connection" && hint.id !== "connection-error" && hint.id !== "unsupported-rules");
  const shownSteps = steps.slice(0, MAX_HINTS);

  const healthy = connection.configured && !connection.error;
  const staff = overview.staff;
  const summary = [
    `${activeSectors.length} ${activeSectors.length === 1 ? "setor ativo" : "setores ativos"}${overview.sectors.length > 0 ? ` de ${overview.sectors.length}` : ""}`,
    `${overview.peopleGroups.length} ${overview.peopleGroups.length === 1 ? "grupo de pessoas" : "grupos de pessoas"}`,
    staff ? `${staff.agents} ${staff.agents === 1 ? "agente" : "agentes"} e ${staff.managers + staff.admins} ${staff.managers + staff.admins === 1 ? "gestor" : "gestores"}` : null,
  ].filter(Boolean);

  return (
    <AdminShell>
      <SectionHeader title="Visão geral" description={summary.join(" · ")} />

      {!healthy && (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <CircleAlert className="size-5 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-base font-medium text-foreground">{!connection.configured ? "Zammad não configurado" : "Problema na conexão com o Zammad"}</p>
              <p className="text-sm break-words text-muted-foreground">
                {!connection.configured ? "Defina as variáveis ZAMMAD_URL e ZAMMAD_API_TOKEN no projeto e faça um novo deploy." : connection.error}
              </p>
            </div>
            {connection.configured && <ReloadSchemaButton />}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Próximos passos {steps.length > 0 && <span className="font-normal text-muted-foreground">({steps.length})</span>}
        </h3>
        {shownSteps.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
            Tudo em ordem por aqui. Nada pendente.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {shownSteps.map((hint) => (
              <li key={hint.id}>
                <StepRow hint={hint} />
              </li>
            ))}
            {steps.length > shownSteps.length && <li className="px-4 py-3 text-xs text-muted-foreground">E mais {steps.length - shownSteps.length} pendências menores.</li>}
          </ul>
        )}
      </section>

      {overview.unsupported.length > 0 && (
        <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden />
            <span className="flex-1">
              {overview.unsupported.length} {overview.unsupported.length === 1 ? "regra do Zammad" : "regras do Zammad"} que o portal não sabe aplicar
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">O formulário pode divergir do Zammad nestes pontos. Simplifique a regra lá ou peça suporte ao plugin.</p>
            <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
              {overview.unsupported.map((message) => (
                <li key={message} className="break-words">
                  {message}
                </li>
              ))}
            </ul>
            {overview.skippedFields.length > 0 && <p className="text-xs text-muted-foreground">Campos de tipo não suportado (ficam fora do formulário): {overview.skippedFields.join(", ")}.</p>}
          </div>
        </details>
      )}

      {healthy && (
        <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
            <span className="min-w-0 flex-1 truncate">
              Conectado ao Zammad
              {overview.schemaFetchedAt && <span className="text-muted-foreground"> · campos lidos em {formatDateTime(overview.schemaFetchedAt)}</span>}
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">Detalhes</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-3 border-t px-4 py-3">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Endereço</dt>
                <dd className="truncate text-foreground">{connection.baseUrl}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Dono do token</dt>
                <dd className="truncate text-foreground">{connection.tokenOwner ? `${connection.tokenOwner.name} (${connection.tokenOwner.email})` : "Não identificado"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Os campos se atualizam sozinhos a cada 5 minutos.</p>
              <ReloadSchemaButton />
            </div>
          </div>
        </details>
      )}
    </AdminShell>
  );
}

function StepRow({ hint }: { hint: AdminHint }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{hint.title}</span>
        <span className="block text-xs break-words text-muted-foreground">{hint.description}</span>
      </span>
      {hint.href && (
        <Button asChild variant="outline" size="sm">
          <Link href={hint.href}>{hintAction(hint.href)}</Link>
        </Button>
      )}
    </div>
  );
}
