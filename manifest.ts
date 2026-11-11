import type { PluginManifest } from "@venore/plugin-sdk";

// Faixa escrita à mão, não importada do CORE_VERSION corrente (mesmo motivo dos outros plugins:
// importar a versão corrente tornaria a checagem sempre trivial).
export const zammadManifest: PluginManifest = {
  manifestVersion: "1.0.0",
  key: "zammad",
  name: "Chamados (Zammad)",
  version: "0.4.0",
  description:
    "Abertura e acompanhamento de chamados no Zammad (headless) em passos guiados: a pessoa escolhe o setor, responde uma pergunta por vez e depois conversa com a equipe pelo portal. Os campos de cada setor vêm do próprio Zammad (atributos e Core Workflows); aqui só se ajusta a apresentação.",
  compatibility: { coreVersion: ">=2.0.0 <3.0.0" },
  permissions: [
    { key: "zammad.tickets", label: "Abrir chamados e acompanhar os próprios chamados" },
    { key: "zammad.settings.manage", label: "Configurar a abertura de chamados (setores visíveis, etapas e textos de ajuda)" },
  ],
  navigation: [
    {
      key: "zammad.admin",
      label: "Chamados",
      href: "/admin/zammad",
      icon: "life-buoy",
      groupKey: "plugins",
      groupLabel: "Plugins",
      groupOrder: 30,
      order: 50,
      requiredPermission: "zammad.settings.manage",
    },
  ],
};
