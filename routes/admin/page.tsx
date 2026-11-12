import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Layers, Smartphone, Type, Users } from "lucide-react";
import { AdminStatTile, Card, CardContent, CardHeader, CardTitle } from "@venore/plugin-sdk/ui";
import { getAdminOverviewHandler } from "../../features/admin-overview/handler";
import { ADMIN_BASE, MAX_HINTS, buildHints, type AdminHint } from "../../shared/admin-hints";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "./admin-shell";
import { ReloadSchemaButton } from "./overview-tools";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

const HINT_STYLE: Record<AdminHint["tone"], string> = {
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  info: "bg-primary/10 text-primary",
};

const SHORTCUTS: { href: string; title: string; description: string; icon: ReactNode }[] = [
  { href: `${ADMIN_BASE}/setores`, title: "Setores", description: "Nomes, etapas, ajudas e quem enxerga cada fluxo.", icon: <Layers className="size-5" aria-hidden /> },
  { href: `${ADMIN_BASE}/grupos`, title: "Grupos de pessoas", description: "Monte grupos por setor e libere os fluxos de cada um.", icon: <Users className="size-5" aria-hidden /> },
  { href: `${ADMIN_BASE}/app`, title: "App", description: "Nome, ícone e instalação no celular.", icon: <Smartphone className="size-5" aria-hidden /> },
  { href: `${ADMIN_BASE}/textos`, title: "Textos", description: "A mensagem de abertura do assistente.", icon: <Type className="size-5" aria-hidden /> },
];

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
  const shownHints = hints.slice(0, MAX_HINTS);

  const healthy = connection.configured && !connection.error;
  const staff = overview.staff;

  return (
    <AdminShell>
      <section className="space-y-4">
        <SectionHeader title="Visão geral" description="Como está a conexão com o Zammad e o que vale ajustar agora." actions={connection.configured ? <ReloadSchemaButton /> : undefined} />

        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${healthy ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
            >
              {healthy ? <CircleCheck className="size-5" aria-hidden /> : <CircleAlert className="size-5" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-base font-medium text-foreground">
                  {!connection.configured ? "Zammad não configurado" : connection.error ? "Problema na conexão com o Zammad" : "Conectado ao Zammad"}
                </p>
                <p className="mt-0.5 text-sm break-words text-muted-foreground">
                  {!connection.configured
                    ? "Defina as variáveis ZAMMAD_URL e ZAMMAD_API_TOKEN no projeto e faça um novo deploy."
                    : connection.error
                      ? connection.error
                      : "O token está válido e os campos dos setores foram lidos."}
                </p>
              </div>
              {connection.configured && (
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">Endereço</dt>
                    <dd className="truncate text-foreground">{connection.baseUrl}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">Dono do token</dt>
                    <dd className="truncate text-foreground">{connection.tokenOwner ? `${connection.tokenOwner.name} (${connection.tokenOwner.email})` : "Não identificado"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">Última leitura dos campos</dt>
                    <dd className="text-foreground">{overview.schemaFetchedAt ? formatDateTime(overview.schemaFetchedAt) : "Ainda não lido"}</dd>
                  </div>
                </dl>
              )}
              {connection.configured && <p className="text-xs text-muted-foreground">Os campos se atualizam sozinhos a cada 5 minutos. Mudou algo no Zammad e quer ver agora? Use “Recarregar do Zammad”.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStatTile label="Setores ativos" value={activeSectors.length} hint={overview.sectors.length > 0 ? `de ${overview.sectors.length} no Zammad` : undefined} />
          <AdminStatTile label="Grupos de pessoas" value={overview.peopleGroups.length} hint={`${overview.peopleGroups.reduce((total, group) => total + group.memberCount, 0)} participações`} />
          <AdminStatTile
            label="Agentes e gestores"
            value={staff ? staff.agents + staff.managers + staff.admins : "—"}
            hint={staff ? `${staff.agents} agentes · ${staff.managers} gestores` : "Não foi possível ler a equipe"}
          />
          <AdminStatTile label="Regras não suportadas" value={overview.unsupported.length} hint={overview.unsupported.length === 0 ? "Tudo aplicado" : "Veja abaixo"} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Próximos passos" />
        <Card>
          <CardContent className="p-0">
            {shownHints.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-sm text-foreground">
                <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
                Tudo em ordem por aqui. Nada pendente.
              </p>
            ) : (
              <ul className="divide-y">
                {shownHints.map((hint) => (
                  <li key={hint.id}>
                    <HintRow hint={hint} />
                  </li>
                ))}
              </ul>
            )}
            {hints.length > shownHints.length && <p className="border-t px-4 py-3 text-xs text-muted-foreground">E mais {hints.length - shownHints.length} pendências menores.</p>}
          </CardContent>
        </Card>
      </section>

      {overview.unsupported.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regras do Zammad que o portal não sabe aplicar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">O formulário pode divergir do Zammad nestes pontos. Simplifique a regra lá ou peça suporte ao plugin.</p>
            <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
              {overview.unsupported.map((message) => (
                <li key={message} className="break-words">
                  {message}
                </li>
              ))}
            </ul>
            {overview.skippedFields.length > 0 && <p className="text-xs text-muted-foreground">Campos de tipo não suportado (ficam fora do formulário): {overview.skippedFields.join(", ")}.</p>}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <SectionHeader title="Atalhos" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{shortcut.icon}</span>
              <span className="space-y-1">
                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                  {shortcut.title}
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
                </span>
                <span className="block text-xs text-muted-foreground">{shortcut.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

function HintRow({ hint }: { hint: AdminHint }) {
  const body = (
    <>
      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${HINT_STYLE[hint.tone]}`}>
        <CircleAlert className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{hint.title}</span>
        <span className="block text-xs break-words text-muted-foreground">{hint.description}</span>
      </span>
      {hint.href && <ArrowRight className="mt-1.5 size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />}
    </>
  );
  const base = "flex items-start gap-3 px-4 py-3";
  if (!hint.href) return <div className={base}>{body}</div>;
  return (
    <Link href={hint.href} className={`${base} outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40`}>
      {body}
    </Link>
  );
}
