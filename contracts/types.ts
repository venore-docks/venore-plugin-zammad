// Tipos que a interface usa. Nada aqui depende de servidor: o wizard (cliente) importa daqui.

import type { ZammadAttribute, ZammadWorkflow } from "./zammad";

export type FieldType = "select" | "multiselect" | "boolean" | "date" | "datetime" | "text" | "textarea" | "integer";
export type FieldOption = { value: string; label: string };
export type AnswerValue = string | string[] | boolean | number;

export type WizardField = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: FieldOption[];
  help: string | null;
  maxLength: number | null;
  // date/datetime: o Zammad recusa passado (future) ou futuro (past) quando só um deles é permitido.
  allowFuture: boolean;
  allowPast: boolean;
  defaultValue: AnswerValue | null;
};

// optional: todos os campos da etapa são opcionais (a interface avisa que pode seguir sem responder).
export type WizardStep = { key: string; title: string; fields: WizardField[]; optional: boolean };

// Regras do formulário vindas do Zammad, já recortadas para quem pede: os atributos que o wizard pode perguntar e
// os Core Workflows da tela. O wizard reavalia com elas a cada resposta (`resolveForm` em shared/form.ts): campos
// que dependem de outra resposta (ex.: ferramenta_portal quando sistema_afetado = portal) aparecem e somem na hora.
export type FormRules = {
  screen: string;
  role: "ticket.customer" | "ticket.agent";
  roleIds: number[];
  attributes: ZammadAttribute[];
  workflows: ZammadWorkflow[];
};

// Apresentação dos campos de um setor (configurada no admin do Colabora).
export type FieldPresentation = {
  fieldHelp: Record<string, string>;
  fieldSteps: Record<string, number>;
  stepTitles: Record<string, string>;
};

export type SectorForm = {
  groupId: number;
  parentId: number | null;
  label: string;
  description: string | null;
  bodyHint: string | null;
  order: number | null;
  // Etapas com as respostas ainda vazias; os campos condicionais entram conforme as respostas (`resolveForm`).
  steps: WizardStep[];
  presentation: FieldPresentation;
};

export type WizardData = {
  intro: string | null;
  sectors: SectorForm[];
  rules: FormRules;
  limits: AttachmentLimits;
};

export type AttachmentLimits = { maxFiles: number; maxTotalBytes: number };

export type TicketStateTone = "new" | "open" | "pending" | "closed";

// Cor semântica do estado e dos botões do fluxo. A interface traduz para TOKENS do tema
// (info = chart-2, primary, warning, success, danger = destructive, neutral = muted) — nunca cor fixa.
export type TicketStateColor = "neutral" | "info" | "primary" | "warning" | "success" | "danger";

// Etapas do fluxo da FEM (ver shared/flow.ts). null = Zammad sem esses estados (comportamento genérico).
export type FlowStepKey = "novo" | "em_analise" | "autorizado" | "atribuido" | "nao_autorizado" | "reavaliacao" | "em_andamento" | "em_pausa" | "concluido" | "finalizado";
export type CustomerActionKey = "approve" | "adjust" | "reject" | "not_solved" | "resubmit";

// Botão de decisão do SOLICITANTE (Concluído / Não autorizado): manda a palavra de controle no assunto.
export type CustomerActionOption = {
  key: CustomerActionKey;
  label: string;
  prompt: string;
  color: TicketStateColor;
  reasonRequired: boolean;
};

// Botão de atalho da EQUIPE: muda para `stateId` (com texto público opcional/obrigatório).
export type StaffFlowAction = {
  stateId: number;
  label: string;
  prompt: string;
  color: TicketStateColor;
  reason: "required" | "optional" | "none";
  done: string;
  // Escolha obrigatória que vai junto da mudança (ex.: motivo da pausa, com as opções do campo do Zammad).
  choice?: { field: string; options: FieldOption[] } | null;
};

export type TicketSummary = {
  id: number;
  number: string;
  title: string;
  group: string;
  stateLabel: string;
  stateTone: TicketStateTone;
  stateColor: TicketStateColor;
  closed: boolean;
  // A equipe respondeu e a pessoa ainda não (o chamado está esperando por ela).
  awaitingYou: boolean;
  priorityLabel: string;
  // Nome do solicitante (só nas listas do agente; nas do próprio solicitante é null).
  requesterName: string | null;
  // Tags do Zammad (só nas listas da equipe; ausente nas do solicitante).
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreatedTicket = { id: number; number: string };

export type TicketAttachmentInfo = {
  id: number;
  filename: string;
  size: number;
  isImage: boolean;
  // Rota do próprio portal (o Zammad não é exposto): /api/colabora/tickets/:t/articles/:a/attachments/:id
  href: string;
};

// me = a própria pessoa; customer = o solicitante (só aparece na visão do agente); team = a equipe (ou,
// na visão do solicitante, qualquer outra pessoa que não ele).
export type MessageRole = "me" | "team" | "customer" | "system";

export type TicketMessage = {
  id: number;
  role: MessageRole;
  // Nota interna da equipe: só a visão do agente recebe estas mensagens.
  internal: boolean;
  authorName: string;
  // Avatar da conta do portal (null = só as iniciais).
  avatarUrl: string | null;
  text: string;
  createdAt: string;
  // Resposta a outra mensagem ("Responder"): quem escreveu, um trecho e o id da mensagem original
  // (null se não deu para localizá-la na conversa).
  quote: { author: string; excerpt: string; targetId: number | null } | null;
  // Resumo das respostas do formulário (só no 1º artigo de chamados abertos pelo portal).
  answers: { label: string; value: string }[];
  attachments: TicketAttachmentInfo[];
};

export type AgentStateOption = { id: number; label: string; tone: TicketStateTone; needsPending: boolean };
export type AgentPriorityOption = { id: number; label: string };

// Controles do agente/gestor (app).
//   canWork      o chamado está COM a pessoa: só então responde ou escreve nota.
//   canAllocate  gestor/admin: atribui, realoca ou devolve à fila (agente comum NUNCA aloca).
//   canEdit      muda estado e prioridade: quem trabalha o chamado ou o supervisiona.
// Chamado sem responsável (fila) só aparece para gestor/admin.
export type AgentControls = {
  canWork: boolean;
  canAllocate: boolean;
  canEdit: boolean;
  ownerId: number | null;
  // Quem pode receber este chamado (agentes do grupo). Só vem com canAllocate.
  assignees: { id: number; name: string }[];
  stateId: number;
  priorityId: number;
  // No fluxo da FEM: só os estados para onde ESTA pessoa pode levar o chamado (mais o atual).
  states: AgentStateOption[];
  priorities: AgentPriorityOption[];
  // O chamado está no fluxo da FEM (estados por nome). Fora dele, os atalhos genéricos de antes.
  inFlow: boolean;
  // Atalhos do fluxo (Autorizar, Não autorizar, Concluir…). Vazio fora do fluxo da FEM.
  flowActions: StaffFlowAction[];
  // Dica do passo atual para a equipe (ex.: "Atribua um responsável: o chamado vai para Em andamento").
  flowHint: string | null;
  // Escreve no chamado (resposta ou nota interna): quem atende OU o gestor do setor (acompanha os agentes).
  canComment: boolean;
  // Define o tempo previsto (só gestor/admin do setor). As opções vêm do campo do Zammad.
  canSetEstimate: boolean;
  estimateOptions: { value: string; label: string }[];
  // O Zammad tem o campo de prazo de entrega (o administrador do setor o edita junto do tempo previsto).
  hasDeadline: boolean;
  // Chamado filho: quem atende ou o gestor cria. `childGroups` = setores para "pedir a outro setor";
  // subtarefa usa `assignees` (gestor escolhe o agente; o agente fica com ela).
  canCreateChild: boolean;
  childGroups: { id: number; label: string }[];
};

// Chamado vinculado (pai ou filho), com o mínimo para a lista.
export type LinkedTicket = {
  id: number;
  number: string;
  title: string;
  group: string;
  stateLabel: string;
  stateTone: TicketStateTone;
  stateColor: TicketStateColor;
  closed: boolean;
  ownerName: string | null;
};

// Tempo previsto do chamado (campo `tempo_previsto` do Zammad). null = o Zammad não tem o campo.
export type TicketEstimate = { value: string | null; label: string | null };

// Uma mudança no histórico do chamado (só na visão da equipe; fonte: histórico do Zammad).
export type TicketHistoryKind = "created" | "state" | "owner" | "group" | "priority" | "estimate";
export type TicketHistoryEntry = {
  at: string;
  kind: TicketHistoryKind;
  // Rótulos legíveis (estado pelo nome do fluxo, setor com "›"). null = vazio (ex.: sem responsável).
  from: string | null;
  to: string | null;
  // Quem mudou ("Sistema" = gatilho/agendador do Zammad). null = desconhecido.
  byName: string | null;
};

export type TicketDetail = {
  // Histórico (abertura e mudanças de estado, responsável, setor, prioridade, tempo previsto). Só na visão da
  // equipe; null quando o Zammad não o entrega (visão do solicitante, falha de leitura).
  history: TicketHistoryEntry[] | null;
  // Tempo previsto (esforço de trabalho): só a equipe vê (v1.12.0, como no Zammad); só o administrador do setor edita.
  estimate: TicketEstimate | null;
  // Prazo de entrega (compromisso do setor): todos veem; só o administrador do setor edita. `local` =
  // "YYYY-MM-DDTHH:mm" em UTC-3 (campo datetime-local); null = sem prazo ou o Zammad sem o campo.
  deadline: { iso: string; local: string } | null;
  // Em pausa: o motivo (rótulo do Zammad). Só na visão da equipe.
  pauseReason: string | null;
  // Anotações só do plugin (ex.: "Interrompido por #1234"), as mais recentes primeiro. Só na visão da equipe.
  pluginNotes: { text: string; createdAt: string }[];
  // Vínculos (só na visão da equipe): chamado pai e chamados filhos. `openChildren` bloqueia concluir o pai.
  parent: LinkedTicket | null;
  children: LinkedTicket[];
  openChildren: number;
  id: number;
  number: string;
  title: string;
  group: string;
  stateLabel: string;
  stateTone: TicketStateTone;
  stateColor: TicketStateColor;
  closed: boolean;
  awaitingYou: boolean;
  // Etapa do fluxo da FEM e a explicação dela para quem vê (null fora do fluxo).
  flowStep: FlowStepKey | null;
  flowHint: string | null;
  // Decisões do solicitante neste passo (só para quem abriu o chamado; vazio nos demais casos).
  customerActions: CustomerActionOption[];
  // O solicitante pode escrever mensagem comum? (false em Concluído/Não autorizado/Finalizado.)
  customerCanReply: boolean;
  customerReplyBlocked: string | null;
  // O solicitante escreveu por último: na visão do agente, o chamado espera resposta dele.
  customerWaiting: boolean;
  // Só agente/admin do Zammad encerra e reabre; colaborador comum só responde.
  canClose: boolean;
  createdAt: string;
  updatedAt: string;
  priorityLabel: string;
  // "agent" = visão do agente (app): notas internas, solicitante, controles. "customer" = a do solicitante.
  viewer: "customer" | "agent";
  requester: { name: string; email: string | null };
  // null = sem responsável (na fila).
  owner: { name: string } | null;
  assignedToMe: boolean;
  // Só na visão do agente.
  agent: AgentControls | null;
  // Tags do Zammad — só na visão da equipe (vazio para o solicitante).
  tags: string[];
  messages: TicketMessage[];
};

// Quem enxerga o setor na abertura de chamados.
//   all      todos os colaboradores
//   groups   só quem está em algum dos grupos de pessoas de `groupIds` (lista vazia = ninguém, exceto admin)
//   inherit  usa a audiência do setor pai (setor raiz com "inherit" = todos)
export type AudienceMode = "all" | "groups" | "inherit";
export type SectorAudience = { mode: AudienceMode; groupIds: string[] };

// Grupo de pessoas (ex.: "TI", "RH"), guardado no setting `colabora.groups`. Settings são de leitura
// pública: só ids de usuário do Venore, nunca nome nem e-mail.
export type PeopleGroup = {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
  createdAt: string;
};

// Configuração de apresentação guardada no setting `colabora.wizard` (o Zammad continua dono dos campos).
export type GroupWizardConfig = {
  enabled: boolean;
  // Config antiga sem `audience` vale `{ mode: "inherit", groupIds: [] }` (= todos, num setor raiz).
  audience: SectorAudience;
  label: string | null;
  description: string | null;
  bodyHint: string | null;
  order: number | null;
  fieldHelp: Record<string, string>;
  fieldSteps: Record<string, number>;
  stepTitles: Record<string, string>;
};

export type WizardConfig = {
  intro: string | null;
  // Nome do app instalável (PWA), ex.: "Colabora FEM". Vazio = "Chamados · <nome do site>".
  appName: string | null;
  groups: Record<string, GroupWizardConfig>;
};
