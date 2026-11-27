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

// ── Regras ÚNICAS de contagem (todo número de chamado do plugin sai daqui) ─────────────────────────────────────────

// Aberto = tudo que não é Finalizado (só Finalizado encerra: v1.10.0). Concluído e Não autorizado ainda esperam o
// solicitante e contam como abertos.
export function isOpenTicket(ticket: { state?: string | null }): boolean {
  return !describeState(ticket.state ?? "").closed;
}

// Esperam a decisão do gestor: Novo, Em análise, Autorizado (falta atribuir) e Reavaliação. Vale com ou sem
// responsável: um Novo que já tem responsável (atribuído por fora do plugin) continua esperando análise.
export const DECISION_STEPS: readonly FlowStep[] = ["novo", "em_analise", "autorizado", "reavaliacao"];

export function isAwaitingDecision(ticket: { state?: string | null }): boolean {
  const step = flowStepOf(ticket.state);
  return step !== null && DECISION_STEPS.includes(step);
}

// A equipe fez uma pergunta e espera o solicitante (estado Aguardando solicitante). Não é trabalho do agente.
export function isAwaitingRequester(ticket: { state?: string | null }): boolean {
  return flowStepOf(ticket.state) === "aguardando_solicitante";
}

// O SOLICITANTE respondeu: escreveu DEPOIS da última resposta da equipe. Não conta:
//   - a mensagem de abertura (sem resposta da equipe, só vale se ele escreveu de novo depois de abrir);
//   - chamado que o próprio responsável abriu (gestor/agente testando: não há outro solicitante);
//   - chamado em Aguardando solicitante (a pergunta é da equipe; quem espera é o solicitante).
// Usa os carimbos do ticket (a lista não traz os artigos); a tela do chamado usa requesterRepliedAfterAgent.
const CREATION_GRACE_MS = 60_000;
export function isCustomerWaiting(ticket: {
  state?: string | null;
  owner_id?: number | null;
  customer_id?: number;
  created_at?: string;
  last_contact_agent_at?: string | null;
  last_contact_customer_at?: string | null;
}): boolean {
  if (isAwaitingRequester(ticket)) return false;
  if (ticket.customer_id !== undefined && ticket.owner_id === ticket.customer_id) return false;
  if (!ticket.last_contact_customer_at) return false;
  const customerAt = new Date(ticket.last_contact_customer_at).getTime();
  if (!ticket.last_contact_agent_at) {
    // O contato do solicitante na abertura cai na hora da criação; só conta se houve outro depois.
    const createdAt = ticket.created_at ? new Date(ticket.created_at).getTime() : customerAt;
    return customerAt - createdAt > CREATION_GRACE_MS;
  }
  return customerAt > new Date(ticket.last_contact_agent_at).getTime();
}

// A equipe falou por último e a pessoa ainda não respondeu (usa os carimbos do próprio ticket).
export function isAwaitingYou(ticket: { last_contact_agent_at?: string | null; last_contact_customer_at?: string | null }, closed: boolean): boolean {
  if (closed || !ticket.last_contact_agent_at) return false;
  if (!ticket.last_contact_customer_at) return true;
  return new Date(ticket.last_contact_agent_at).getTime() > new Date(ticket.last_contact_customer_at).getTime();
}
