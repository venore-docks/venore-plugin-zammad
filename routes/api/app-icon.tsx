import { ImageResponse } from "next/og";
import { asPluginApiHandler, isPluginActive } from "@venore/plugin-sdk";
import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { toIconSource, type IconSource } from "../../shared/icon-source";

// GET /api/colabora/app/icon?size=192|512|180&maskable=1&bg=%23rrggbb&v=<versão>
//
// Ícone do app = o FAVICON do site (Configurações → Marca), desenhado no centro de um quadrado PNG do
// tamanho que a PWA exige (192 e 512; 180 para o iOS). Sem isto o navegador usaria os ícones padrão do
// core (o logo do Venore). PÚBLICO (o navegador busca ícone de manifest sem cookies). `v` só serve para
// invalidar cache quando o favicon muda.
const SIZES = new Set([180, 192, 512]);
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_FAVICON_BYTES = 2 * 1024 * 1024;

async function readFavicon(url: string): Promise<IconSource | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_FAVICON_BYTES ? toIconSource(bytes) : null;
  } catch {
    return null;
  }
}

export const getAppIcon = asPluginApiHandler(async (request) => {
  if (!(await isPluginActive("colabora"))) return Response.json({ error: "O plugin de chamados está desativado." }, { status: 404 });

  const params = new URL(request.url).searchParams;
  const size = Number(params.get("size"));
  if (!SIZES.has(size)) return Response.json({ error: "Tamanho inválido (180, 192 ou 512)." }, { status: 400 });
  const maskable = params.get("maskable") === "1";
  const background = HEX.test(params.get("bg") ?? "") ? (params.get("bg") as string) : "#ffffff";

  const brand = await getBrandConfig();
  // "Ícone do app (PWA)" da identidade do site (/admin/settings/brand); sem ele, o favicon.
  const favicon = await readFavicon(new URL(brand.pwaIconUrl ?? brand.faviconUrl, request.url).toString());
  if (!favicon) {
    // Formato que não dá para desenhar (ex.: .ico antigo, WebP): cai nos ícones do core em vez de quebrar a instalação.
    const fallback = maskable ? "/icons/icon-maskable-512.png" : size >= 512 ? "/icons/icon-512.png" : "/icons/icon-192.png";
    return Response.redirect(new URL(fallback, request.url), 302);
  }

  // Favicon que já é um quadrado cheio (PNG/JPEG sem transparência) ocupa o ícone TODO — encaixá-lo numa moldura
  // de outra cor fica feio. Com transparência (ou SVG), o desenho vai centralizado sobre a cor de fundo; no
  // maskable o sistema recorta até 20% das bordas, então fica na zona segura (≈56%).
  const inner = favicon.opaque ? size : Math.round(size * (maskable ? 0.56 : 0.72));
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={favicon.uri} width={inner} height={inner} alt="" style={{ objectFit: favicon.opaque ? "cover" : "contain" }} />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
});
