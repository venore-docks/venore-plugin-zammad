// Caminhos das duas superfícies do Colabora. Puro: usado por servidor e cliente.
//   portal  páginas dentro da casca do Venore Docks, em /colabora…
//   app     PWA própria, SEM a casca, em /ext/colabora/app… (o dispatcher /ext do core serve a área `standalone`).
// As duas têm as MESMAS telas e o mesmo desenho de caminhos; só muda a base e a moldura (frame). Por isso as
// páginas são "views" compartilhadas (routes/views) que recebem a chave da superfície.
export const PORTAL_BASE = "/colabora";
export const APP_BASE = "/ext/colabora/app";

// Caminhos antigos (antes do Colabora): só redirecionam para os novos (routes/legacy.tsx).
export const LEGACY_PORTAL_BASE = "/chamados";
export const LEGACY_APP_BASE = "/ext/zammad/app";

export type SurfaceKey = "portal" | "app";

export type Surface = {
  key: SurfaceKey;
  /** Início: o dashboard do papel da pessoa. */
  home: string;
  /** Meus chamados (os que a pessoa abriu). */
  mine: string;
  newTicket: string;
  /** Atribuídos a mim (agente, gestor, admin). */
  assigned: string;
  /** Fila: chamados sem responsável (gestor, admin). */
  queue: string;
  /** Equipe: agentes e carga (gestor, admin). */
  team: string;
  /** Chamados de um agente da equipe (gestor, admin). */
  teamAgent: (agentId: number) => string;
  /** A conversa de um chamado. */
  detail: (ticketId: number) => string;
};

function makeSurface(key: SurfaceKey, base: string): Surface {
  return {
    key,
    home: base,
    mine: `${base}/meus`,
    newTicket: `${base}/novo`,
    assigned: `${base}/atribuidos`,
    queue: `${base}/fila`,
    team: `${base}/equipe`,
    teamAgent: (agentId) => `${base}/equipe/${agentId}`,
    detail: (ticketId) => `${base}/chamado/${ticketId}`,
  };
}

export const PORTAL_SURFACE: Surface = makeSurface("portal", PORTAL_BASE);
export const APP_SURFACE: Surface = makeSurface("app", APP_BASE);

export function surfaceFor(key: SurfaceKey): Surface {
  return key === "app" ? APP_SURFACE : PORTAL_SURFACE;
}
