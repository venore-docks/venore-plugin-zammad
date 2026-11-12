import { describe, expect, it } from "vitest";
import { appNames, buildAppManifest, iconUrl } from "./app-manifest";

describe("appNames", () => {
  it("usa o nome configurado no admin", () => {
    expect(appNames("Colabora FEM", "Colaborador FEM")).toEqual({ name: "Colabora FEM", shortName: "Colabora FEM" });
    expect(appNames("  Colabora FEM  ", null).name).toBe("Colabora FEM");
  });

  it("sem nome configurado: 'Colabora · <site>'", () => {
    expect(appNames(null, "Colaborador FEM")).toEqual({ name: "Colabora · Colaborador FEM", shortName: "Colabora" });
    expect(appNames("  ", null)).toEqual({ name: "Colabora", shortName: "Colabora" });
  });
});

describe("iconUrl", () => {
  it("leva tamanho, versão e a cor de fundo (só hex válido)", () => {
    expect(iconUrl(192, { version: "abc", background: "#ffffff" })).toBe("/api/colabora/app/icon?size=192&v=abc&bg=%23ffffff");
    expect(iconUrl(512, { version: "abc", maskable: true })).toBe("/api/colabora/app/icon?size=512&v=abc&maskable=1");
    expect(iconUrl(192, { version: "abc", background: "red; drop" })).not.toContain("bg=");
  });
});

describe("buildAppManifest", () => {
  const base = { name: "Colaborador FEM", lang: "pt-BR", dir: "ltr", background_color: "#ffffff", theme_color: "#006b82", start_url: "/", id: "/" };

  it("identidade do app, ícones vindos do favicon do site e cores do tema", () => {
    const manifest = buildAppManifest({ base, appName: "Colabora FEM", siteName: "Colaborador FEM", iconVersion: "v1" }) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      name: "Colabora FEM",
      short_name: "Colabora FEM",
      id: "/ext/colabora/app",
      start_url: "/ext/colabora/app?origem=pwa",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#006b82",
    });
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.map((icon) => [icon.sizes, icon.purpose])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
    // NÃO usa mais os ícones padrão do core (logo do Venore): todos saem da rota do favicon.
    expect(icons.every((icon) => icon.src.startsWith("/api/colabora/app/icon?"))).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain("/icons/icon-");
  });

  it("o app tem identidade própria: não reaproveita id nem página inicial do site", () => {
    const manifest = buildAppManifest({ base, appName: null, siteName: null, iconVersion: "v1" });
    expect(manifest.id).not.toBe("/");
    expect(manifest.start_url).not.toBe("/");
  });

  it("sem manifest do site (falha ao buscar) ainda produz um manifest instalável", () => {
    const manifest = buildAppManifest({ base: null, appName: null, siteName: null, iconVersion: "v1" });
    expect(manifest.name).toBe("Colabora");
    expect(manifest.start_url).toBe("/ext/colabora/app?origem=pwa");
    expect((manifest.icons as unknown[]).length).toBe(3);
    expect(manifest.shortcuts).toEqual([expect.objectContaining({ url: "/ext/colabora/app/novo" })]);
  });
});
