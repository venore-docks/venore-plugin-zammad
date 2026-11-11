import type { Metadata } from "next";

// <head> de toda página do app (o dispatcher /ext do core lê o generateMetadata da entrada): aponta para o
// manifest PRÓPRIO — é ele que faz o navegador oferecer "instalar Chamados" em vez do portal inteiro — e
// marca o app como instalável no iOS. `noindex`: é uma área logada.
export function appMetadata(): Metadata {
  return {
    title: "Chamados",
    applicationName: "Chamados",
    manifest: "/api/zammad/app/manifest",
    appleWebApp: { capable: true, title: "Chamados", statusBarStyle: "default" },
    formatDetection: { telephone: false },
    robots: { index: false, follow: false },
  };
}
