// - tickets: usar o Colabora (abrir/acompanhar chamados; agentes e gestores também). Dar ao papel dos
//   colaboradores em /admin/rbac.
// - settingsManage: administrar. Também autoriza gravar o setting `colabora.*` no core
//   (permissionsToWriteSetting aceita `<namespace>.settings.manage`).
//
// COMPATIBILIDADE: o plugin se chamava `zammad` até a v0.5. Quem já tinha o papel com `zammad.tickets`
// (ou `zammad.settings.manage`) continua autorizado, para a troca de chave não derrubar ninguém. Remover o
// legado quando todos os papéis tiverem sido regravados com as permissões `colabora.*`.
export const COLABORA_PERMISSIONS: { tickets: string[]; settingsManage: string[] } = {
  tickets: ["colabora.tickets", "zammad.tickets"],
  settingsManage: ["colabora.settings.manage", "zammad.settings.manage"],
};

export const WIZARD_SETTING_KEY = "colabora.wizard";
// Setting onde a configuração ficava antes da troca de chave: lida só como reserva (ver wizard-config.ts).
export const LEGACY_WIZARD_SETTING_KEY = "zammad.wizard";
