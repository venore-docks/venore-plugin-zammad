import { asPluginApiHandler, isPluginActive } from "@venore/plugin-sdk";
import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { buildAppManifest, type BaseManifest } from "../../shared/app-manifest";
import { iconVersion } from "../../shared/icon-source";
import { readWizardConfig } from "../../shared/wizard-config";

// GET /api/zammad/app/manifest — manifest da PWA.
//
// PÚBLICO, de propósito: o navegador busca o manifest sem cookies (é assim que `<link rel="manifest">` se
// comporta), então aqui não há dado de ninguém — só o nome do app (configurado no admin), o favicon do site
// (via /api/zammad/app/icon) e as cores do tema, que vêm do manifest que o core publica em
// /manifest.webmanifest.
async function readSiteManifest(request: Request): Promise<BaseManifest | null> {
  try {
    const response = await fetch(new URL("/manifest.webmanifest", request.url), {
      headers: { Accept: "application/manifest+json, application/json" },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as BaseManifest) : null;
  } catch {
    return null;
  }
}

export const getAppManifest = asPluginApiHandler(async (request) => {
  if (!(await isPluginActive("zammad"))) return Response.json({ error: "O plugin de chamados está desativado." }, { status: 404 });
  const [base, brand, config] = await Promise.all([readSiteManifest(request), getBrandConfig(), readWizardConfig()]);
  const manifest = buildAppManifest({ base, appName: config.appName, siteName: brand.siteName, iconVersion: iconVersion(brand.pwaIconUrl ?? brand.faviconUrl) });
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Cache CURTO e sempre revalidado: trocar o nome do app no admin precisa valer na próxima instalação (com 1 h
      // de cache, quem reinstalava logo depois ainda recebia o manifest antigo).
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
    },
  });
});
