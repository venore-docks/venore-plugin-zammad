import type { TicketStateTone } from "../contracts/types";

// Nomes padrão do Zammad traduzidos; estado criado à mão (ex.: "em andamento") aparece como está.
const STATE_LABELS: Record<string, { label: string; tone: TicketStateTone }> = {
  new: { label: "Recebido", tone: "new" },
  open: { label: "Em atendimento", tone: "open" },
  "pending reminder": { label: "Aguardando retorno", tone: "pending" },
  "pending close": { label: "Será encerrado em breve", tone: "pending" },
  closed: { label: "Encerrado", tone: "closed" },
  merged: { label: "Unificado a outro chamado", tone: "closed" },
};

export function describeState(state: string): { label: string; tone: TicketStateTone; closed: boolean } {
  const known = STATE_LABELS[state.toLowerCase()];
  if (known) return { ...known, closed: known.tone === "closed" };
  return { label: state.charAt(0).toUpperCase() + state.slice(1), tone: "open", closed: false };
}

// O SOLICITANTE escreveu depois da última resposta da equipe (ou a equipe ainda não respondeu): na visão
// do agente, o chamado espera resposta dele.
export function isCustomerWaiting(ticket: { last_contact_agent_at?: string | null; last_contact_customer_at?: string | null }): boolean {
  if (!ticket.last_contact_customer_at) return false;
  if (!ticket.last_contact_agent_at) return true;
  return new Date(ticket.last_contact_customer_at).getTime() > new Date(ticket.last_contact_agent_at).getTime();
}

// A equipe falou por último e a pessoa ainda não respondeu (usa os carimbos do próprio ticket).
export function isAwaitingYou(ticket: { last_contact_agent_at?: string | null; last_contact_customer_at?: string | null }, closed: boolean): boolean {
  if (closed || !ticket.last_contact_agent_at) return false;
  if (!ticket.last_contact_customer_at) return true;
  return new Date(ticket.last_contact_agent_at).getTime() > new Date(ticket.last_contact_customer_at).getTime();
}
