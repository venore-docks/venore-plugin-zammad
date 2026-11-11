import { APP_BASE } from "./routes";

// Manifest da PWA "Chamados". Parte do manifest do próprio site (cores de chrome, ícones, idioma — que o
// core monta a partir do tema) e troca só a identidade do app: nome, id, página inicial, atalhos.
// Pura: testada em app-manifest.test.ts.
//
// `scope: "/"` de propósito: o login e o resto do portal ficam no mesmo domínio, e fora do escopo o
// navegador abriria uma barra de endereço por cima do app. O app em si só navega dentro de /ext/zammad/app.
export type BaseManifest = {
  name?: string;
  short_name?: string;
  lang?: string;
  dir?: string;
  background_color?: string;
  theme_color?: string;
  icons?: { src: string; sizes?: string; type?: string; purpose?: string }[];
  [key: string]: unknown;
};

export const FALLBACK_ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export function buildAppManifest(base: BaseManifest | null): Record<string, unknown> {
  const siteName = (base?.name ?? "").trim();
  return {
    name: siteName ? `Chamados · ${siteName}` : "Chamados",
    short_name: "Chamados",
    description: "Abra, acompanhe e responda chamados. Agentes trabalham os chamados atribuídos a eles.",
    lang: base?.lang ?? "pt-BR",
    dir: base?.dir ?? "ltr",
    id: APP_BASE,
    start_url: `${APP_BASE}?origem=pwa`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["business", "productivity"],
    background_color: base?.background_color,
    theme_color: base?.theme_color,
    icons: base?.icons && base.icons.length > 0 ? base.icons : FALLBACK_ICONS,
    shortcuts: [
      {
        name: "Abrir chamado",
        short_name: "Novo",
        url: `${APP_BASE}/novo`,
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
