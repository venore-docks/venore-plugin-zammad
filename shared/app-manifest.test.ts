import { describe, expect, it } from "vitest";
import { FALLBACK_ICONS, buildAppManifest } from "./app-manifest";

describe("buildAppManifest", () => {
  it("herda cores, ícones e idioma do manifest do site e troca a identidade do app", () => {
    const manifest = buildAppManifest({
      name: "Portal do Colaborador",
      short_name: "Portal",
      lang: "pt-BR",
      dir: "ltr",
      background_color: "#ffffff",
      theme_color: "#006b82",
      icons: [{ src: "/media/icone.png", sizes: "512x512", type: "image/png" }],
      start_url: "/",
      id: "/",
    });
    expect(manifest).toMatchObject({
      name: "Chamados · Portal do Colaborador",
      short_name: "Chamados",
      id: "/ext/zammad/app",
      start_url: "/ext/zammad/app?origem=pwa",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#006b82",
      icons: [{ src: "/media/icone.png", sizes: "512x512", type: "image/png" }],
    });
    // O app tem identidade própria: não pode reaproveitar o id nem a página inicial do site.
    expect(manifest.id).not.toBe("/");
    expect(manifest.start_url).not.toBe("/");
  });

  it("sem manifest do site (falha ao buscar) ainda produz um manifest instalável", () => {
    const manifest = buildAppManifest(null);
    expect(manifest.name).toBe("Chamados");
    expect(manifest.icons).toEqual(FALLBACK_ICONS);
    expect(manifest.start_url).toBe("/ext/zammad/app?origem=pwa");
    expect(manifest.shortcuts).toEqual([expect.objectContaining({ url: "/ext/zammad/app/novo" })]);
  });
});
