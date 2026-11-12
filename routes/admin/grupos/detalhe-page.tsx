import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { getAdminOverviewHandler } from "../../../features/admin-overview/handler";
import { getPeopleGroupHandler } from "../../../features/manage-people-groups/handler";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "../admin-shell";
import { GroupEditor, type SectorOption } from "../group-editor";

export default async function ColaboraAdminGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { groupId } = await params;
  const [group, overview] = await Promise.all([getPeopleGroupHandler({ groupId }), getAdminOverviewHandler({ level: "sectors" })]);

  const back = (
    <Button variant="outline" asChild>
      <Link href="/admin/colabora/grupos">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        Grupos de pessoas
      </Link>
    </Button>
  );

  if (!group.success) {
    return (
      <AdminShell>
        <SectionHeader title="Grupo não encontrado" description={group.error.message} actions={back} />
      </AdminShell>
    );
  }
  if (!overview.success) return <LoadError message={overview.error.message} />;

  const sectors: SectorOption[] = overview.data.sectors.map((sector) => ({
    groupId: sector.groupId,
    name: sector.config.label || sector.zammadName,
    isChild: sector.parentId !== null,
    audience: sector.audience.label,
  }));

  return (
    <AdminShell>
      <SectionHeader title={group.data.name} description="Quem faz parte deste grupo e quais setores ele pode usar na abertura de chamados." actions={back} />
      <GroupEditor group={group.data} sectors={sectors} />
    </AdminShell>
  );
}
