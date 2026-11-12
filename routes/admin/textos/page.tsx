import { getAdminOverviewHandler } from "../../../features/admin-overview/handler";
import { AdminShell, LoadError, SectionHeader, guardAdmin } from "../admin-shell";
import { IntroForm } from "../app-texts-forms";

export default async function ColaboraAdminTextsPage() {
  const denied = await guardAdmin();
  if (denied) return denied;

  const result = await getAdminOverviewHandler({ level: "config" });
  if (!result.success) return <LoadError message={result.error.message} />;

  return (
    <AdminShell>
      <section className="space-y-4">
        <SectionHeader title="Textos" description="As mensagens que a pessoa lê ao abrir um chamado. Os textos de cada setor ficam na edição do setor." />
        <IntroForm intro={result.data.intro} />
      </section>
    </AdminShell>
  );
}
