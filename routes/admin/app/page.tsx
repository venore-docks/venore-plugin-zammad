import Link from "next/link";
import { ExternalLink, Image as ImageIcon, Smartphone } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@venore/plugin-sdk/ui";
import { getAdminOverviewHandler } from "../../../features/admin-overview/handler";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "../admin-shell";
import { AppNameForm } from "../app-texts-forms";

const APP_URL = "/ext/colabora/app";

export default async function ColaboraAdminAppPage() {
  const denied = await guardAdmin();
  if (denied) return denied;

  const result = await getAdminOverviewHandler({ level: "config" });
  if (!result.success) return <LoadError message={result.error.message} />;

  return (
    <AdminShell>
      <section className="space-y-4">
        <SectionHeader
          title="App no celular"
          description="O Colabora também funciona como app instalável (PWA), sem o menu e o rodapé do portal. É a mesma conta e as mesmas telas."
          actions={
            <Button variant="outline" asChild>
              <a href={APP_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Abrir o app
              </a>
            </Button>
          }
        />

        <AppNameForm appName={result.data.appName} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                Ícone do app
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                O ícone vem de <span className="font-medium text-foreground">Configurações → Identidade do site → “Ícone do app (PWA)”</span>. Sem ele, o app usa o favicon do site. Imagens
                PNG, JPEG, GIF, SVG e .ico são aceitas.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/settings/brand">Abrir Identidade do site</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="size-4 text-muted-foreground" aria-hidden />
                Como instalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Endereço do app: <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{APP_URL}</code>
              </p>
              <ol className="list-decimal space-y-1.5 ps-5 text-muted-foreground">
                <li>Abra o endereço do app no navegador do celular e entre com sua conta.</li>
                <li>
                  <span className="font-medium text-foreground">Android (Chrome):</span> toque em “Instalar app” no aviso ou no menu ⋮.
                </li>
                <li>
                  <span className="font-medium text-foreground">iPhone (Safari):</span> toque em Compartilhar e depois em “Adicionar à Tela de Início”.
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">Notificações push e modo offline ainda não estão disponíveis.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </AdminShell>
  );
}
