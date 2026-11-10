import { notFound, redirect } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getWizard } from "../../index";
import { BlockedNotice } from "./shared";
import { TicketWizard } from "./ticket-wizard";

// /chamados/novo — abertura guiada. `?setor=<id do grupo no Zammad>` já começa no setor (para links
// diretos de páginas do portal, ex.: "Pedir material ao Marketing").
export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ setor?: string }> }) {
  if (!(await isPluginActive("zammad"))) notFound();
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect("/login?callbackUrl=%2Fchamados%2Fnovo");

  const result = await getWizard();
  if (!result.success) {
    return (
      <div className="py-10">
        <BlockedNotice title="Abrir chamado" message={result.error.message} showBack />
      </div>
    );
  }

  const { setor } = await searchParams;
  const requested = Number(setor);
  const initialGroupId = Number.isInteger(requested) && result.data.sectors.some((sector) => sector.groupId === requested) ? requested : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Abrir chamado</h1>
        <p className="text-sm text-muted-foreground">Uma pergunta por vez — leva poucos minutos.</p>
      </div>
      <TicketWizard data={result.data} initialGroupId={initialGroupId} />
    </div>
  );
}
