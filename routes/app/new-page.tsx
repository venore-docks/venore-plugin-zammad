import { notFound, redirect } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getWizard } from "../../index";
import { APP_BASE, APP_SURFACE } from "../../shared/routes";
import { BlockedNotice } from "../public/shared";
import { TicketWizard } from "../public/ticket-wizard";
import { AppShell } from "./shell";

// /ext/zammad/app/novo — o mesmo passo a passo do portal, na casca do app. `?setor=<id>` começa no setor.
export default async function AppNewTicketPage({ searchParams }: { searchParams: Promise<{ setor?: string }> }) {
  if (!(await isPluginActive("zammad"))) notFound();
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect(`/login?callbackUrl=${encodeURIComponent(`${APP_BASE}/novo`)}`);

  const result = await getWizard();
  if (!result.success) {
    return (
      <AppShell title="Novo chamado" backHref={APP_SURFACE.list}>
        <BlockedNotice title="Abrir chamado" message={result.error.message} />
      </AppShell>
    );
  }

  const { setor } = await searchParams;
  const requested = Number(setor);
  const initialGroupId = Number.isInteger(requested) && result.data.sectors.some((sector) => sector.groupId === requested) ? requested : null;

  return (
    <AppShell title="Novo chamado" backHref={APP_SURFACE.list}>
      <TicketWizard data={result.data} initialGroupId={initialGroupId} surface="app" />
    </AppShell>
  );
}
