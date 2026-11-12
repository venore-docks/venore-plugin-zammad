import { getAdminOverviewHandler } from "../../../features/admin-overview/handler";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "../admin-shell";
import { CreateGroupDialog, GroupEmptyState, GroupList } from "../group-list";

export default async function ColaboraAdminGroupsPage() {
  const denied = await guardAdmin();
  if (denied) return denied;

  // "sectors": os nomes dos setores aparecem nos cartões (o schema do Zammad vem do cache de 5 min).
  const result = await getAdminOverviewHandler({ level: "sectors" });
  if (!result.success) return <LoadError message={result.error.message} />;
  const { peopleGroups, sectors } = result.data;
  const sectorNames = Object.fromEntries(sectors.map((sector) => [String(sector.groupId), sector.config.label || sector.zammadName]));

  return (
    <AdminShell>
      <section className="space-y-4">
        <SectionHeader
          title="Grupos de pessoas"
          description="Nem todo colaborador precisa abrir chamados em todos os setores. Monte grupos por área e libere cada setor só para quem faz sentido."
          actions={peopleGroups.length > 0 ? <CreateGroupDialog variant="outline" /> : undefined}
        />
        {peopleGroups.length === 0 ? <GroupEmptyState /> : <GroupList groups={peopleGroups} sectorNames={sectorNames} />}
      </section>
    </AdminShell>
  );
}
