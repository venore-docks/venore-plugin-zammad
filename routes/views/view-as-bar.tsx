import { getViewAsStatus } from "../../index";
import { ViewAsControls } from "./view-as-controls";

// Lê o estado do "ver como" por conta própria (não depende do viewer): a faixa com "Sair" aparece mesmo quando
// a tela falhou — por exemplo, a pessoa vista não tem conta no Zammad.
export async function ViewAsBar({ showPicker, homeHref }: { showPicker: boolean; homeHref: string }) {
  const status = await getViewAsStatus();
  if (!status.success) return null;
  const { canViewAs, target } = status.data;
  if (!target && !(canViewAs && showPicker)) return null;
  return <ViewAsControls target={target} canPick={canViewAs} homeHref={homeHref} />;
}
