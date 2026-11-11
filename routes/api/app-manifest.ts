import { asPluginApiHandler, isPluginActive } from "@venore/plugin-sdk";
import { buildAppManifest, type BaseManifest } from "../../shared/app-manifest";

// GET /api/zammad/app/manifest — manifest da PWA "Chamados".
//
// PÚBLICO, de propósito: o navegador busca o manifest sem cookies (é assim que `<link rel="manifest">` se
// comporta), então aqui não há dado de ninguém — só a identidade do app + cores/ícones do site, que vêm
// do manifest que o próprio core já publica em /manifest.webmanifest.
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
  const manifest = buildAppManifest(await readSiteManifest(request));
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Muda raramente (nome do site, cores do tema); uma hora de cache poupa o self-fetch.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
});
