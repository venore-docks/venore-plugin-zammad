import { notFound, redirect } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getAppViewer } from "../../index";
import type { AppViewer } from "../../index";

// Porta de entrada de toda tela do Colabora (portal e app): plugin ativo, pessoa logada e quem ela é no
// atendimento (colaborador, agente, gestor ou admin). Plugin desligado = 404; sem login = login e volta para
// `returnPath`; sem conta no Zammad (ou integração fora do ar) = `ok: false` com a mensagem para a tela mostrar.
export type Entered = { ok: true; viewer: AppViewer } | { ok: false; message: string };

export async function enterSurface(returnPath: string): Promise<Entered> {
  if (!(await isPluginActive("colabora"))) notFound();
  const user = await getCurrentUser();
  if (!user.success || !user.data) redirect(`/login?callbackUrl=${encodeURIComponent(returnPath)}`);

  const viewer = await getAppViewer();
  if (!viewer.success) return { ok: false, message: viewer.error.message };
  return { ok: true, viewer: viewer.data };
}
