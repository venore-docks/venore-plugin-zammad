// Caminhos das duas superfícies do plugin. Puro: usado por servidor e cliente.
//   portal: páginas dentro da casca do Venore Docks (/chamados…)
//   app:    PWA própria, SEM a casca (/ext/zammad/app…) — o dispatcher /ext do core serve a área `standalone`.
export const PORTAL_BASE = "/chamados";
export const APP_BASE = "/ext/zammad/app";

export type Surface = { list: string; newTicket: string; detail: (ticketId: number) => string };

export const PORTAL_SURFACE: Surface = {
  list: PORTAL_BASE,
  newTicket: `${PORTAL_BASE}/novo`,
  detail: (ticketId) => `${PORTAL_BASE}/${ticketId}`,
};

export const APP_SURFACE: Surface = {
  list: APP_BASE,
  newTicket: `${APP_BASE}/novo`,
  detail: (ticketId) => `${APP_BASE}/chamado/${ticketId}`,
};
