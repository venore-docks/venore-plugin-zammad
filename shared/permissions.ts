// - tickets: abrir chamados e ver os próprios (dar ao papel padrão de colaborador em /admin/rbac).
// - settingsManage: configurar a apresentação. Também autoriza gravar o setting `zammad.*` no core
//   (permissionsToWriteSetting aceita `<namespace>.settings.manage`).
export const ZAMMAD_PERMISSIONS = {
  tickets: "zammad.tickets",
  settingsManage: "zammad.settings.manage",
} as const;

export const WIZARD_SETTING_KEY = "zammad.wizard";
