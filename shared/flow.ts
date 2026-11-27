// Fluxo de atendimento da FEM (Zammad configurado à mão — ver docs/zammad-fem.md). Puro: testado em
// flow.test.ts.
//
//   Novo → Em análise → Autorizado ─(gestor atribui agente)→ Atribuído ─(agente inicia)→ Em andamento → Concluído
//                    ↘ Não autorizado ─(cliente reenvia)→ Reavaliação → Autorizado | Não autorizado
//
// Só FINALIZADO encerra de verdade (v1.10.0). Todos os outros passos, inclusive Não autorizado (o solicitante ainda
// pode reenviar) e Concluído (ainda espera o retorno dele), são chamados em aberto: contam nas listas, na carga da
// equipe e na regra do pai com filho em aberto.
//   Atribuído (v1.9.0) é opcional: num Zammad sem esse estado, atribuir leva direto a Em andamento (gatilho
//   "Administrador atribui agente"), como antes.
//   Concluído ─(cliente aprova | 48 h, agendador)→ Finalizado
//   Concluído ─(cliente pede ajustes | não resolvido)→ Em andamento;  ─(cliente rejeita)→ Em análise
//
// Quem muda o quê (espelha os Core Workflows 600–607 do Zammad, que só valem na tela do Zammad — a API
// não os aplica, então o plugin repete a regra no servidor):
//   gestor (supervisor)  Novo/Em análise/Autorizado/Reavaliação → Em análise, Autorizado, Não autorizado, Reavaliação
//   agente (responsável) Atribuído → Em andamento ("Iniciar atendimento"); Em andamento ↔ Concluído
//   cliente              NUNCA muda estado: manda um artigo com a palavra de controle no ASSUNTO e os
//                        gatilhos do Zammad fazem a transição (e as tags/avisos).
//
// O fluxo só vale quando o estado atual do chamado é um destes (por NOME, sem acento/caixa); um Zammad
// sem esses estados continua no comportamento genérico (encerrar/reabrir).

import type { CustomerActionKey, FlowStepKey, TicketStateColor } from "../contracts/types";

export type FlowStep = FlowStepKey;

// Cor semântica do estado/botão — vira classe de TOKEN do tema na interface (nunca cor fixa).
export type FlowColor = TicketStateColor;

type StepInfo = { label: string; color: FlowColor; closed: boolean; hint: string };

export const FLOW_STEPS: Record<FlowStep, StepInfo> = {
  novo: { label: "Novo", color: "info", closed: false, hint: "Na fila do gestor do setor." },
  em_analise: { label: "Em análise", color: "warning", closed: false, hint: "O gestor está analisando o pedido." },
  autorizado: { label: "Autorizado", color: "success", closed: false, hint: "Autorizado. Aguardando um responsável." },
  atribuido: { label: "Atribuído", color: "info", closed: false, hint: "Já tem um responsável, que vai iniciar o atendimento." },
  nao_autorizado: { label: "Não autorizado", color: "danger", closed: false, hint: "O gestor não autorizou o pedido. Ainda não foi encerrado: o solicitante pode reenviar." },
  reavaliacao: { label: "Reavaliação", color: "warning", closed: false, hint: "Reenviado: o gestor vai analisar de novo." },
  em_andamento: { label: "Em andamento", color: "primary", closed: false, hint: "Um responsável está trabalhando no pedido." },
  em_pausa: { label: "Em pausa", color: "warning", closed: false, hint: "O atendimento está pausado e volta para Em andamento quando for retomado." },
  aguardando_solicitante: { label: "Aguardando solicitante", color: "info", closed: false, hint: "Esperando a resposta do solicitante. O chamado volta para Em andamento quando ele responder." },
  concluido: { label: "Concluído", color: "success", closed: false, hint: "Entregue. Confira e dê o seu retorno." },
  finalizado: { label: "Finalizado", color: "neutral", closed: true, hint: "Chamado finalizado." },
};

// O único passo que encerra o chamado.
export const FINAL_STEP: FlowStep = "finalizado";

export function isFinalStep(step: FlowStep | null | undefined): boolean {
  return step === FINAL_STEP;
}

const BY_NAME: Record<string, FlowStep> = {
  novo: "novo",
  nova: "novo",
  "em analise": "em_analise",
  autorizado: "autorizado",
  atribuido: "atribuido",
  atribuida: "atribuido",
  "nao autorizado": "nao_autorizado",
  reavaliacao: "reavaliacao",
  "em andamento": "em_andamento",
  "em pausa": "em_pausa",
  "aguardando solicitante": "aguardando_solicitante",
  concluido: "concluido",
  finalizado: "finalizado",
};

export function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function flowStepOf(stateName: string | null | undefined): FlowStep | null {
  if (!stateName) return null;
  return BY_NAME[normalizeName(stateName)] ?? null;
}

// ── Cliente: botões que mandam a palavra de controle ─────────────────────────────────────────────

export type CustomerAction = CustomerActionKey;

export type CustomerActionInfo = {
  // Vai no ASSUNTO do artigo; os gatilhos do Zammad leem "Assunto contém …".
  word: string;
  label: string;
  // Texto do diálogo: o que a pessoa precisa explicar.
  prompt: string;
  color: FlowColor;
  reasonRequired: boolean;
  // De que estado o botão aparece.
  from: FlowStep;
  done: string;
};

export const CUSTOMER_ACTIONS: Record<CustomerAction, CustomerActionInfo> = {
  approve: {
    word: "[APROVADO]",
    label: "Aprovar",
    prompt: "Quer deixar um comentário para a equipe? (opcional)",
    color: "success",
    reasonRequired: false,
    from: "concluido",
    done: "Obrigado! Chamado aprovado.",
  },
  adjust: {
    word: "[AJUSTAR]",
    label: "Pedir ajustes",
    prompt: "O que precisa ser ajustado?",
    color: "warning",
    reasonRequired: true,
    from: "concluido",
    done: "Pedido de ajustes enviado.",
  },
  not_solved: {
    word: "[NAO_RESOLVIDO]",
    label: "Problema não resolvido",
    prompt: "O que ainda não está funcionando?",
    color: "warning",
    reasonRequired: true,
    from: "concluido",
    done: "Avisamos a equipe de que o problema continua.",
  },
  reject: {
    word: "[REJEITADO]",
    label: "Rejeitar entrega",
    prompt: "Por que a entrega não serve? O gestor vai analisar de novo.",
    color: "danger",
    reasonRequired: true,
    from: "concluido",
    done: "Entrega rejeitada. O gestor vai analisar.",
  },
  resubmit: {
    word: "[REENVIAR]",
    label: "Reenviar para análise",
    prompt: "O que mudou no pedido? Explique para o gestor reavaliar.",
    color: "primary",
    reasonRequired: true,
    from: "nao_autorizado",
    done: "Pedido reenviado para reavaliação.",
  },
};

const CUSTOMER_ORDER: CustomerAction[] = ["approve", "adjust", "not_solved", "reject", "resubmit"];

export function customerActionsFor(step: FlowStep | null): CustomerAction[] {
  if (!step) return [];
  return CUSTOMER_ORDER.filter((action) => CUSTOMER_ACTIONS[action].from === step);
}

export function isCustomerAction(value: unknown): value is CustomerAction {
  return typeof value === "string" && value in CUSTOMER_ACTIONS;
}

// Pode o SOLICITANTE escrever uma mensagem comum? Em Concluído e Não autorizado a resposta é pelos
// botões (uma mensagem solta em Concluído cairia no gatilho de reserva "pede ajustes"); Finalizado não
// reabre (abre-se um chamado novo).
export function customerCanReply(step: FlowStep | null): boolean {
  return step !== "concluido" && step !== "nao_autorizado" && step !== "finalizado";
}

export function customerReplyBlockedMessage(step: FlowStep | null): string {
  if (step === "concluido") return "Este chamado foi concluído. Use os botões acima para aprovar ou pedir ajustes.";
  if (step === "nao_autorizado") return "Este pedido não foi autorizado. Use “Reenviar para análise” para explicar o que mudou.";
  return "Este chamado foi finalizado. Se precisar de algo mais, abra um novo chamado.";
}

// ── Equipe: transições por papel ─────────────────────────────────────────────────────────────────

const SUPERVISOR_FROM: FlowStep[] = ["novo", "em_analise", "autorizado", "reavaliacao"];
const SUPERVISOR_TO: FlowStep[] = ["em_analise", "autorizado", "nao_autorizado", "reavaliacao"];
// Responsável: de onde para onde. Atribuído só anda para Em andamento (o agente inicia o atendimento; concluir
// direto pularia o tempo de atendimento).
// Em pausa (v1.12.0) só sai para Em andamento (regras 650/651 do Zammad).
const WORKER_MOVES: Partial<Record<FlowStep, FlowStep[]>> = {
  atribuido: ["em_andamento"],
  em_andamento: ["concluido", "em_pausa", "aguardando_solicitante"],
  em_pausa: ["em_andamento"],
  aguardando_solicitante: ["em_andamento"],
  concluido: ["em_andamento"],
};
// Pausar e retomar: o responsável E o gestor do setor (decisão de 27/11/2026).
const SUPERVISOR_MOVES: Partial<Record<FlowStep, FlowStep[]>> = {
  em_andamento: ["em_pausa", "aguardando_solicitante"],
  em_pausa: ["em_andamento"],
  aguardando_solicitante: ["em_andamento"],
};

export type FlowActor = { supervisor: boolean; worker: boolean };

export function allowedTargets(current: FlowStep, actor: FlowActor): FlowStep[] {
  const targets = new Set<FlowStep>();
  if (actor.supervisor && SUPERVISOR_FROM.includes(current)) SUPERVISOR_TO.forEach((step) => targets.add(step));
  if (actor.supervisor) (SUPERVISOR_MOVES[current] ?? []).forEach((step) => targets.add(step));
  if (actor.worker) (WORKER_MOVES[current] ?? []).forEach((step) => targets.add(step));
  targets.delete(current);
  return [...targets];
}

export function canMoveTo(current: FlowStep, target: FlowStep, actor: FlowActor): boolean {
  return allowedTargets(current, actor).includes(target);
}

// Mudança de responsável no fluxo (regra do servidor, não um botão): dar um responsável a um chamado Autorizado o
// leva a Atribuído; devolver à fila um chamado Atribuído o leva de volta a Autorizado. null = o estado não muda.
// `step` é o passo em que o chamado fica depois do envio (o atual, ou o pedido no mesmo envio, ex.: "Autorizar e
// atribuir").
export function stepAfterOwnerChange(step: FlowStep | null, assigned: boolean): FlowStep | null {
  if (assigned && step === "autorizado") return "atribuido";
  if (!assigned && step === "atribuido") return "autorizado";
  return null;
}

// Botões de atalho da equipe. `reason`: o texto vira artigo PÚBLICO junto da mudança (o aviso ao cliente
// usa #{article.body_as_text}); "required" bloqueia o envio sem texto.
export type StaffActionInfo = {
  target: FlowStep;
  // Só a partir destes passos (ausente = de qualquer passo que permita ir ao alvo).
  from?: FlowStep[];
  label: string;
  color: FlowColor;
  reason: "required" | "optional" | "none";
  prompt: string;
  done: string;
};

const STAFF_ACTIONS: StaffActionInfo[] = [
  { target: "em_analise", label: "Iniciar análise", color: "warning", reason: "none", prompt: "", done: "Chamado em análise." },
  { target: "autorizado", label: "Autorizar", color: "success", reason: "none", prompt: "", done: "Chamado autorizado. Agora atribua um responsável." },
  {
    target: "nao_autorizado",
    label: "Não autorizar",
    color: "danger",
    reason: "required",
    prompt: "Explique o motivo. O solicitante recebe este texto por e-mail.",
    done: "Chamado não autorizado. O solicitante foi avisado.",
  },
  {
    target: "concluido",
    label: "Concluir",
    color: "success",
    reason: "optional",
    prompt: "Quer dizer ao solicitante o que foi feito? (opcional)",
    done: "Chamado concluído. O solicitante vai conferir.",
  },
  { target: "em_andamento", from: ["atribuido"], label: "Iniciar atendimento", color: "primary", reason: "none", prompt: "", done: "Atendimento iniciado. O chamado está em andamento." },
  { target: "em_andamento", from: ["concluido"], label: "Voltar para em andamento", color: "primary", reason: "none", prompt: "", done: "Chamado em andamento." },
  // Pausar pede o motivo (`motivo_pausa`, opções do Zammad) e vai num único PUT com o estado.
  {
    target: "em_pausa",
    label: "Pausar",
    color: "warning",
    reason: "none",
    prompt: "Por que o atendimento vai parar? O tempo de trabalho para de contar até você retomar.",
    done: "Atendimento pausado.",
  },
  { target: "em_andamento", from: ["em_pausa"], label: "Retomar", color: "primary", reason: "none", prompt: "", done: "Atendimento retomado." },
  // Aguardar o solicitante: o texto é a pergunta/pedido ao solicitante (vai como nota PÚBLICA no mesmo envio e o
  // gatilho do Zammad avisa por e-mail). Quando ele responde, o gatilho 30 devolve o chamado a Em andamento.
  {
    target: "aguardando_solicitante",
    label: "Aguardar solicitante",
    color: "info",
    reason: "required",
    prompt: "O que você precisa que o solicitante responda? Ele recebe este texto por e-mail e o tempo de trabalho para de contar.",
    done: "Chamado aguardando a resposta do solicitante.",
  },
  // Voltar a Em andamento sem esperar a resposta (o gatilho só age quando o solicitante escreve).
  { target: "em_andamento", from: ["aguardando_solicitante"], label: "Retomar sem resposta", color: "primary", reason: "none", prompt: "", done: "Atendimento retomado." },
];

// Campo do Zammad com o motivo da pausa (obrigatório ao entrar em Em pausa — regra 800).
export const PAUSE_REASON_FIELD = "motivo_pausa";
// Motivo da pausa automática quando o agente inicia outro chamado (um Em andamento por agente).
export const AUTO_PAUSE_REASON = "urgencia";

// Um agente tem UM chamado Em andamento por vez: ao levar `ticketId` para Em andamento, os outros chamados Em
// andamento do mesmo responsável são pausados (motivo urgência). Retomar é sempre explícito.
export function inProgressToPause<T extends { id: number; state?: string | null }>(ownerTickets: readonly T[], ticketId: number): T[] {
  return ownerTickets.filter((ticket) => ticket.id !== ticketId && flowStepOf(ticket.state) === "em_andamento");
}

export function staffActionsFor(current: FlowStep, actor: FlowActor): StaffActionInfo[] {
  const targets = allowedTargets(current, actor);
  return STAFF_ACTIONS.filter((action) => targets.includes(action.target) && (!action.from || action.from.includes(current)));
}

export function staffActionFor(target: FlowStep, current?: FlowStep): StaffActionInfo | null {
  return STAFF_ACTIONS.find((action) => action.target === target && (!current || !action.from || action.from.includes(current))) ?? null;
}

// O chamado espera algo do solicitante (aparece como "esperando você" nas listas dele): uma decisão (Concluído, Não
// autorizado) ou a resposta a uma pergunta da equipe (Aguardando solicitante).
export function customerMustDecide(step: FlowStep | null): boolean {
  return step === "concluido" || step === "nao_autorizado" || step === "aguardando_solicitante";
}

// Dica do passo para a equipe (o que fazer agora). null = nada a sugerir.
export function staffHintFor(step: FlowStep, actor: FlowActor & { hasOwner: boolean }): string | null {
  if (actor.supervisor && step === "novo") return "Novo pedido: inicie a análise, autorize ou não autorize.";
  if (actor.supervisor && step === "reavaliacao") return "O solicitante reenviou o pedido. Leia a explicação e decida de novo.";
  if (actor.supervisor && step === "autorizado" && !actor.hasOwner) return "Atribua um responsável: ao atribuir, o chamado passa para Atribuído.";
  if (actor.worker && step === "atribuido") return "Este chamado é seu. Quando começar a trabalhar nele, toque em Iniciar atendimento.";
  if (actor.supervisor && step === "atribuido") return "Aguardando o responsável iniciar o atendimento.";
  if (actor.worker && step === "em_pausa") return "Atendimento pausado. Toque em Retomar quando voltar a trabalhar nele.";
  if (actor.supervisor && step === "em_pausa") return "Atendimento pausado. O responsável retoma quando voltar a trabalhar nele.";
  if (step === "aguardando_solicitante") return "Esperando a resposta do solicitante. Quando ele responder, o chamado volta sozinho para Em andamento.";
  if (step === "concluido") return "Aguardando o solicitante aprovar ou pedir ajustes (finaliza sozinho em 48 h).";
  if (step === "nao_autorizado") return "Não autorizado. O solicitante pode reenviar com explicação.";
  return null;
}

export const REASON_MAX = 4000;

// Valida o texto que acompanha uma ação (cliente ou equipe). null = ok.
export function validateReason(text: string | null | undefined, required: boolean): string | null {
  const value = (text ?? "").trim();
  if (required && value.length < 3) return "Escreva uma explicação (pelo menos 3 letras).";
  if (value.length > REASON_MAX) return `O texto passou de ${REASON_MAX} caracteres.`;
  return null;
}
