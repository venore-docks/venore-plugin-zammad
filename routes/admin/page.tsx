import Link from "next/link";
import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader, Button, Card, CardContent, CardHeader, CardTitle } from "@venore/plugin-sdk/ui";
import { getAdminOverview } from "../../index";
import { AppNameForm, GroupConfigCard, IntroForm, ReloadSchemaButton } from "./config-forms";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export default async function ZammadAdminPage() {
  const gate = await getPluginAdminPageData("zammad");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para configurar os chamados." />;

  const result = await getAdminOverview();
  if (!result.success) return <p className="text-sm text-destructive">Erro ao carregar: {result.error.message}</p>;
  const overview = result.data;
  const { connection } = overview;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Chamados (Zammad)"
        description="Os campos de cada setor vêm do Zammad (atributos de ticket e Core Workflows). Aqui você escolhe quais setores aparecem, agrupa as perguntas em etapas e escreve os textos de ajuda."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/chamados/novo" target="_blank">
                <ExternalLink className="size-4" />
                Ver abertura de chamado
              </Link>
            </Button>
            {connection.configured && <ReloadSchemaButton />}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!connection.configured ? (
            <p className="flex items-start gap-2 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              Defina as variáveis de ambiente ZAMMAD_URL e ZAMMAD_API_TOKEN no projeto e faça um novo deploy.
            </p>
          ) : connection.error ? (
            <p className="flex items-start gap-2 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {connection.baseUrl}: {connection.error}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-foreground">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              Conectado a {connection.baseUrl}
              {connection.tokenOwner && ` como ${connection.tokenOwner.name} (${connection.tokenOwner.email})`}.
            </p>
          )}
          {overview.schemaFetchedAt && (
            <p className="text-xs text-muted-foreground">
              Campos lidos do Zammad em {formatDateTime(overview.schemaFetchedAt)} (atualiza sozinho a cada 5 minutos).
            </p>
          )}
          {overview.unsupported.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive/40 p-3">
              <p className="font-medium text-destructive">Regras do Zammad que o portal não sabe aplicar</p>
              <p className="text-xs text-muted-foreground">
                O formulário daqui pode divergir do Zammad nestes pontos — simplifique a regra no Zammad ou peça suporte no plugin.
              </p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {overview.unsupported.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {overview.skippedFields.length > 0 && (
            <p className="text-xs text-muted-foreground">Campos de tipo não suportado (ficam fora do formulário): {overview.skippedFields.join(", ")}.</p>
          )}
        </CardContent>
      </Card>

      <AppNameForm appName={overview.appName} />

      <IntroForm intro={overview.intro} />

      {overview.sectors.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Setores</h2>
            <p className="text-sm text-muted-foreground">
              Cada grupo ativo do Zammad é um setor. Sem configuração, as perguntas são agrupadas automaticamente em poucas etapas (escolhas sozinhas, datas juntas, opcionais no fim).
            </p>
          </div>
          {overview.sectors.map((sector) => (
            <GroupConfigCard key={sector.groupId} sector={sector} />
          ))}
        </section>
      )}
    </div>
  );
}
