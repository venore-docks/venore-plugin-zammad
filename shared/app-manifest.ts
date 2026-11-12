import { APP_BASE } from "./routes";

// Manifest da PWA. Parte do manifest do próprio site (cores de chrome e idioma, que o core monta a partir
// do tema) e define a identidade do app: nome, id, página inicial, atalhos e ÍCONES (o favicon do site,
// servido por /api/colabora/app/icon). Pura: testada em app-manifest.test.ts.
//
// `scope: "/"` de propósito: o login e o resto do portal ficam no mesmo domínio, e fora do escopo o
// navegador abriria uma barra de endereço por cima do app. O app em si só navega dentro de /ext/colabora/app.
export type BaseManifest = {
  name?: string;
  lang?: string;
  dir?: string;
  background_color?: string;
  theme_color?: string;
  [key: string]: unknown;
};

export const ICON_ROUTE = "/api/colabora/app/icon";
const HEX = /^#[0-9a-fA-F]{6}$/;

export function iconUrl(size: number, options: { version: string; background?: string | null; maskable?: boolean }): string {
  const params = new URLSearchParams({ size: String(size), v: options.version });
  if (options.maskable) params.set("maskable", "1");
  if (options.background && HEX.test(options.background)) params.set("bg", options.background);
  return `${ICON_ROUTE}?${params.toString()}`;
}

// Nome do app: o configurado no admin ("Colabora FEM"); sem ele, "Colabora · <nome do site>".
export function appNames(appName: string | null | undefined, siteName: string | null | undefined): { name: string; shortName: string } {
  const configured = (appName ?? "").trim();
  if (configured) return { name: configured, shortName: configured };
  const site = (siteName ?? "").trim();
  return { name: site ? `Colabora · ${site}` : "Colabora", shortName: "Colabora" };
}

export function buildAppManifest(input: {
  base: BaseManifest | null;
  appName: string | null;
  siteName: string | null;
  iconVersion: string;
}): Record<string, unknown> {
  const { base, iconVersion } = input;
  const names = appNames(input.appName, input.siteName ?? base?.name);
  const background = typeof base?.background_color === "string" ? base.background_color : null;
  return {
    name: names.name,
    short_name: names.shortName,
    description: "Abra, acompanhe e responda chamados. A equipe atende e a gestão aloca.",
    lang: base?.lang ?? "pt-BR",
    dir: base?.dir ?? "ltr",
    id: APP_BASE,
    start_url: `${APP_BASE}?origem=pwa`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["business", "productivity"],
    background_color: background ?? undefined,
    theme_color: typeof base?.theme_color === "string" ? base.theme_color : undefined,
    icons: [
      { src: iconUrl(192, { version: iconVersion, background }), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl(512, { version: iconVersion, background }), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconUrl(512, { version: iconVersion, background, maskable: true }), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Abrir chamado",
        short_name: "Novo",
        url: `${APP_BASE}/novo`,
        icons: [{ src: iconUrl(192, { version: iconVersion, background }), sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
