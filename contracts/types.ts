// Tipos que a interface usa. Nada aqui depende de servidor: o wizard (cliente) importa daqui.

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

export type SectorForm = {
  groupId: number;
  parentId: number | null;
  label: string;
  description: string | null;
  bodyHint: string | null;
  order: number | null;
  steps: WizardStep[];
};

export type WizardData = {
  intro: string | null;
  sectors: SectorForm[];
  limits: AttachmentLimits;
};

export type AttachmentLimits = { maxFiles: number; maxTotalBytes: number };

export type TicketStateTone = "new" | "open" | "pending" | "closed";

export type TicketSummary = {
  id: number;
  number: string;
  title: string;
  group: string;
  stateLabel: string;
  stateTone: TicketStateTone;
  closed: boolean;
  // A equipe respondeu e a pessoa ainda não (o chamado está esperando por ela).
  awaitingYou: boolean;
  priorityLabel: string;
  // Nome do solicitante (só nas listas do agente; nas do próprio solicitante é null).
  requesterName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatedTicket = { id: number; number: string };

export type TicketAttachmentInfo = {
  id: number;
  filename: string;
  size: number;
  isImage: boolean;
  // Rota do próprio portal (o Zammad não é exposto): /api/zammad/tickets/:t/articles/:a/attachments/:id
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
  states: AgentStateOption[];
  priorities: AgentPriorityOption[];
};

export type TicketDetail = {
  id: number;
  number: string;
  title: string;
  group: string;
  stateLabel: string;
  stateTone: TicketStateTone;
  closed: boolean;
  awaitingYou: boolean;
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
  messages: TicketMessage[];
};

// Configuração de apresentação guardada no setting `zammad.wizard` (o Zammad continua dono dos campos).
export type GroupWizardConfig = {
  enabled: boolean;
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
