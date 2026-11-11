import type { Metadata } from "next";
import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { appNames, iconUrl } from "../../shared/app-manifest";
import { iconVersion } from "../../shared/icon-source";
import { readWizardConfig } from "../../shared/wizard-config";

// <head> de toda página do app (o dispatcher /ext do core lê o generateMetadata da entrada): aponta para o
// manifest PRÓPRIO — é ele que faz o navegador oferecer "instalar" o app em vez do portal inteiro —, define o
// ícone do iOS (o favicon do site) e marca o app como instalável. `noindex`: é uma área logada.
export async function appMetadata(): Promise<Metadata> {
  const [brand, config] = await Promise.all([getBrandConfig(), readWizardConfig()]);
  const { name, shortName } = appNames(config.appName, brand.siteName);
  return {
    title: name,
    applicationName: name,
    manifest: "/api/zammad/app/manifest",
    // `icons` da página SUBSTITUI o do layout raiz: sem repetir icon/shortcut, a aba perdia o favicon do site.
    icons: {
      icon: brand.faviconUrl,
      shortcut: brand.faviconUrl,
      apple: [{ url: iconUrl(180, { version: iconVersion(brand.pwaIconUrl ?? brand.faviconUrl) }), sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: shortName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    robots: { index: false, follow: false },
  };
}
