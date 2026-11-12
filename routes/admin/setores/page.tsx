import { Layers } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { getAdminOverviewHandler } from "../../../features/admin-overview/handler";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "../admin-shell";
import { ReloadSchemaButton } from "../overview-tools";
import { SectorList } from "../sector-list";

export default async function ColaboraAdminSectorsPage() {
  const denied = await guardAdmin();
  if (denied) return denied;

  const result = await getAdminOverviewHandler({ level: "sectors" });
  if (!result.success) return <LoadError message={result.error.message} />;
  const { sectors, connection } = result.data;

  return (
    <AdminShell>
      <section className="space-y-4">
        <SectionHeader
          title="Setores"
          description="Cada grupo ativo do Zammad é um setor. As perguntas vêm do Zammad; aqui você escolhe o que aparece, como as perguntas se agrupam em etapas e quem pode abrir cada fluxo."
          actions={connection.configured ? <ReloadSchemaButton /> : undefined}
        />
        {sectors.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-8" strokeWidth={1.5} />}
            title={connection.configured ? "Nenhum setor encontrado" : "Zammad não configurado"}
            description={
              connection.configured
                ? "Não há grupos ativos no Zammad, ou a leitura falhou. Confira a conexão na visão geral."
                : "Defina ZAMMAD_URL e ZAMMAD_API_TOKEN nas variáveis do projeto para listar os setores."
            }
          />
        ) : (
          <SectorList sectors={sectors} />
        )}
      </section>
    </AdminShell>
  );
}
