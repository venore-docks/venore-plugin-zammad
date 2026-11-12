import { redirect } from "next/navigation";
import { APP_SURFACE, PORTAL_SURFACE, type Surface } from "../shared/routes";

// Endereços de antes do Colabora (/chamados… e /ext/zammad/app…): só redirecionam para os novos. Mantêm vivos os
// links já distribuídos (menus do CMS, favoritos) e o app que os testadores instalaram (start_url antigo).
function withSetor(path: string, setor: string | undefined): string {
  return setor ? `${path}?setor=${encodeURIComponent(setor)}` : path;
}

// /chamados e /ext/zammad/app (?aba=atribuidos|fila|equipe|meus).
const TAB_TARGETS: Record<string, keyof Pick<Surface, "assigned" | "queue" | "team" | "mine">> = {
  atribuidos: "assigned",
  fila: "queue",
  equipe: "team",
  meus: "mine",
};

export function legacyEntries(surface: Surface) {
  return {
    // /chamados era "meus chamados"; o app tinha abas em ?aba=.
    Home: async ({ searchParams }: { searchParams: Promise<{ aba?: string; agente?: string }> }) => {
      const { aba, agente } = await searchParams;
      if (surface.key === "portal") redirect(surface.mine);
      const target = aba ? TAB_TARGETS[aba] : undefined;
      if (target === "team" && Number(agente) > 0) redirect(surface.teamAgent(Number(agente)));
      redirect(target ? surface[target] : surface.home);
    },
    New: async ({ searchParams }: { searchParams: Promise<{ setor?: string }> }) => {
      const { setor } = await searchParams;
      redirect(withSetor(surface.newTicket, setor));
    },
    Ticket: async ({ params }: { params: Promise<{ ticketId: string }> }) => {
      const { ticketId } = await params;
      redirect(surface.detail(Number(ticketId)));
    },
  };
}

export const legacyPortal = legacyEntries(PORTAL_SURFACE);
export const legacyApp = legacyEntries(APP_SURFACE);
