import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { getAdminOverviewHandler } from "../../../features/admin-overview/handler";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "../admin-shell";
import { SectorEditor } from "../sector-editor";

export default async function ColaboraAdminSectorEditPage({ params }: { params: Promise<{ groupId: string }> }) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { groupId } = await params;
  const result = await getAdminOverviewHandler({ level: "sectors" });
  if (!result.success) return <LoadError message={result.error.message} />;
  const { sectors, peopleGroups } = result.data;
  const sector = sectors.find((entry) => String(entry.groupId) === groupId);

  const back = (
    <Button variant="outline" asChild>
      <Link href="/admin/colabora/setores">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        Setores
      </Link>
    </Button>
  );

  if (!sector) {
    return (
      <AdminShell>
        <SectionHeader title="Setor não encontrado" description="Ele pode ter sido desativado ou removido no Zammad." actions={back} />
      </AdminShell>
    );
  }

  const parent = sector.parentId === null ? null : sectors.find((entry) => entry.groupId === sector.parentId);
  return (
    <AdminShell>
      <SectionHeader
        title={sector.config.label || sector.zammadName}
        description="Nome, textos de ajuda, etapas das perguntas e quem pode abrir chamados neste setor."
        actions={back}
      />
      <SectorEditor
        // Recria o editor quando o servidor devolve outra versão (depois de salvar).
        key={JSON.stringify(sector.config)}
        sector={sector}
        parentName={parent ? parent.config.label || parent.zammadName : null}
        peopleGroups={peopleGroups.map((group) => ({ id: group.id, name: group.name, memberCount: group.memberCount }))}
      />
    </AdminShell>
  );
}
