import type { PluginManifest } from "@venore/plugin-sdk";

// Faixa escrita à mão, não importada do CORE_VERSION corrente (mesmo motivo dos outros plugins:
// importar a versão corrente tornaria a checagem sempre trivial).
export const colaboraManifest: PluginManifest = {
  manifestVersion: "1.0.0",
  key: "colabora",
  name: "Colabora",
  version: "1.0.3",
  description:
    "Colabora: central de chamados do colaborador, do agente e do gestor, sobre o Zammad (headless). O colaborador abre chamados em passos guiados e conversa com a equipe; o agente atende os chamados atribuídos a ele; o gestor acompanha a equipe e atribui chamados. Os campos de cada setor vêm do próprio Zammad (atributos e Core Workflows); aqui se ajusta a apresentação e quem pode abrir cada fluxo.",
  compatibility: { coreVersion: ">=2.0.0 <3.0.0" },
  permissions: [
    { key: "colabora.tickets", label: "Usar o Colabora: abrir e acompanhar chamados (colaboradores, agentes e gestores)" },
    { key: "colabora.settings.manage", label: "Administrar o Colabora (setores, grupos de pessoas, app e textos)" },
  ],
  navigation: [
    {
      key: "colabora.admin",
      label: "Colabora",
      href: "/admin/colabora",
      icon: "life-buoy",
      groupKey: "plugins",
      groupLabel: "Plugins",
      groupOrder: 30,
      order: 50,
      requiredPermission: "colabora.settings.manage",
    },
  ],
};
