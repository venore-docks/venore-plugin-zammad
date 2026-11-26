import type { TicketStateColor, TicketStateTone } from "../contracts/types";
import { FLOW_STEPS, flowStepOf, type FlowStep } from "./flow";

// Nomes padrão do Zammad traduzidos; estado criado à mão (ex.: "em andamento") aparece como está.
const STATE_LABELS: Record<string, { label: string; tone: TicketStateTone; color: TicketStateColor }> = {
  new: { label: "Recebido", tone: "new", color: "info" },
  open: { label: "Em atendimento", tone: "open", color: "primary" },
  "pending reminder": { label: "Aguardando retorno", tone: "pending", color: "warning" },
  "pending close": { label: "Será encerrado em breve", tone: "pending", color: "warning" },
  closed: { label: "Encerrado", tone: "closed", color: "neutral" },
  merged: { label: "Unificado a outro chamado", tone: "closed", color: "neutral" },
};

export type DescribedState = { label: string; tone: TicketStateTone; color: TicketStateColor; closed: boolean; step: FlowStep | null };

export function describeState(state: string): DescribedState {
  // Fluxo da FEM (Novo, Em análise, …, Finalizado): nome, cor e "fechado" vêm do fluxo.
  const step = flowStepOf(state);
  if (step) {
    const info = FLOW_STEPS[step];
    const tone: TicketStateTone = step === "novo" ? "new" : info.closed ? "closed" : "open";
    return { label: info.label, tone, color: info.color, closed: info.closed, step };
  }
  const known = STATE_LABELS[state.toLowerCase()];
  if (known) return { ...known, closed: known.tone === "closed", step: null };
  return { label: state.charAt(0).toUpperCase() + state.slice(1), tone: "open", color: "primary", closed: false, step: null };
}

// "Não autorizado" está em aberto (o solicitante pode reenviar), mas não é trabalho do gestor: fica fora da fila de
// decisões e dos números de "na fila".
export function isWaitingOnRequester(ticket: { state?: string | null }): boolean {
  return flowStepOf(ticket.state) === "nao_autorizado";
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
