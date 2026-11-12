import { Home, Inbox, Layers, MessagesSquare, PlusCircle, Users, type LucideIcon } from "lucide-react";
import type { Surface } from "../../shared/routes";

// Navegação do Colabora, igual nas duas superfícies (pílulas no portal, abas embaixo no app). Quem vê o quê:
//   todos        Início · Meus chamados · Abrir chamado
//   agente       + Atribuídos a mim (só o que lhe foi atribuído)
//   gestor/admin + Fila (sem responsável) · Equipe (agentes e carga)
export type NavKey = "home" | "assigned" | "queue" | "team" | "mine" | "new";

export type Who = { isStaff: boolean; isSupervisor: boolean };

type Audience = "all" | "staff" | "supervisor";

type NavDef = {
  key: NavKey;
  label: string;
  /** Rótulo curto (cabe numa aba do celular). */
  shortLabel: string;
  icon: LucideIcon;
  audience: Audience;
  hrefOf: (surface: Surface) => string;
};

const DEFS: NavDef[] = [
  { key: "home", label: "Início", shortLabel: "Início", icon: Home, audience: "all", hrefOf: (s) => s.home },
  { key: "queue", label: "Fila", shortLabel: "Fila", icon: Layers, audience: "supervisor", hrefOf: (s) => s.queue },
  { key: "team", label: "Equipe", shortLabel: "Equipe", icon: Users, audience: "supervisor", hrefOf: (s) => s.team },
  { key: "assigned", label: "Atribuídos a mim", shortLabel: "Atribuídos", icon: Inbox, audience: "staff", hrefOf: (s) => s.assigned },
  { key: "mine", label: "Meus chamados", shortLabel: "Meus", icon: MessagesSquare, audience: "all", hrefOf: (s) => s.mine },
  { key: "new", label: "Abrir chamado", shortLabel: "Novo", icon: PlusCircle, audience: "all", hrefOf: (s) => s.newTicket },
];

export type NavItem = { key: NavKey; label: string; shortLabel: string; icon: LucideIcon; href: string };

function visibleTo(def: NavDef, who: Who): boolean {
  return def.audience === "all" || (def.audience === "staff" && who.isStaff) || (def.audience === "supervisor" && who.isSupervisor);
}

export function navItemsFor(surface: Surface, who: Who): NavItem[] {
  return DEFS.filter((def) => visibleTo(def, who))
    // No celular cabem ~5 abas: o gestor acessa "Meus chamados" pelo dashboard.
    .filter((def) => !(surface.key === "app" && who.isSupervisor && def.key === "mine"))
    .map(({ key, label, shortLabel, icon, hrefOf }) => ({ key, label, shortLabel, icon, href: hrefOf(surface) }));
}
