import { toTicketHistory, type RawHistory } from "../../shared/ticket-history";
import { formatGroupName } from "../../shared/format";
import { zammadRequest } from "../../shared/zammad-client";
import type { AgentControls, CustomerActionOption, FieldOption, LinkedTicket, StaffFlowAction, TicketAttachmentInfo, TicketHistoryEntry, TicketMessage } from "../../contracts/types";
import { DEADLINE_FIELD, deadlineToLocal } from "../../shared/deadline";
import { listPluginNotes } from "../../shared/ticket-store";
import { flattenOptions } from "../../shared/workflow";
import { childGroupOptions, childrenBlockMessage, openChildren } from "../../shared/children";
import { loadLinkedTickets } from "../../shared/ticket-links";
import {
  CUSTOMER_ACTIONS,
  FLOW_STEPS,
  allowedTargets,
  customerActionsFor,
  customerCanReply,
  customerMustDecide,
  customerReplyBlockedMessage,
  flowStepOf,
  PAUSE_REASON_FIELD,
  staffActionsFor,
  staffHintFor,
  type FlowStep,
} from "../../shared/flow";
import type { ZammadArticle, ZammadExpandedTicket } from "../../contracts/zammad";
import { canAllocate, canCommentTicket, canEditTicket, canSetEstimate, canWorkTicket, isUnassigned, type StaffRole, type ViewerMode } from "../../shared/access-rules";
import { ESTIMATE_FIELD, estimateLabel, estimateOptions, type EstimateOption } from "../../shared/estimate";
import { loadSchema } from "../../shared/schema";
import { assigneesFor } from "../../shared/directory";
import { resolveAvatars } from "../../shared/avatars";
import { articleToText, cleanSenderName, extractFormAnswers, extractReplyQuote, makeExcerpt } from "../../shared/html-text";
import { canManageTicketState, loadAgentOptions, loadArticles, loadTicketForViewer } from "../../shared/own-ticket";
import { getPeople, getPerson } from "../../shared/people";
import { loadTicketTags } from "../../shared/ticket-tags";
import type { Requester } from "../../shared/requester";
import { requesterRepliedAfterAgent } from "../../shared/requester-reply";
import { describeState, isAwaitingYou } from "../../shared/ticket-state";
import { priorityLabel } from "../../shared/ticket-options";
import type { GetTicketInput, GetTicketResult } from "./types";

export function attachmentHref(ticketId: number, articleId: number, attachmentId: number): string {
  return `/api/colabora/tickets/${ticketId}/articles/${articleId}/attachments/${attachmentId}`;
}

const SAFE_IMAGE = /^image\/(png|jpe?g|gif|webp|bmp)$/i;

type MessageContext = { requester: Requester; avatars: Map<number, string>; customerId: number; mode: ViewerMode };

function toMessage(article: ZammadArticle, context: MessageContext): TicketMessage {
  const { requester, avatars, customerId, mode } = context;
  const mine = article.created_by_id === requester.zammadUser.id;
  const system = article.sender === "System";
  const isHtml = (article.content_type ?? "").toLowerCase().includes("html");
  // Citação ("Responder") vale em qualquer mensagem escrita pelo portal: da pessoa ou do agente no app.
  const quoted = isHtml ? extractReplyQuote(article.body ?? "") : { html: article.body ?? "", quote: null };
  const split = isHtml ? extractFormAnswers(quoted.html) : { html: quoted.html, answers: [] };
  const attachments: TicketAttachmentInfo[] = (article.attachments ?? []).map((file) => {
    const mime = String(file.preferences?.["Content-Type"] ?? file.preferences?.["Mime-Type"] ?? "");
    return {
      id: file.id,
      filename: file.filename,
      size: Number(file.size) || 0,
      isImage: SAFE_IMAGE.test(mime),
      href: attachmentHref(article.ticket_id, article.id, file.id),
    };
  });
  // Na visão do agente, quem não sou eu e é o solicitante aparece como "customer"; os demais, equipe.
  const role = system ? "system" : mine ? "me" : mode === "agent" && article.created_by_id === customerId ? "customer" : "team";
  return {
    id: article.id,
    role,
    internal: Boolean(article.internal),
    authorName: mine ? "Você" : cleanSenderName(article.from) || (system ? "Sistema" : role === "customer" ? "Solicitante" : "Equipe"),
    avatarUrl: system ? null : (avatars.get(article.created_by_id) ?? null),
    text: articleToText(split.html, article.content_type ?? "text/plain"),
    quote: quoted.quote ? { ...quoted.quote, targetId: null } : null,
    answers: split.answers,
    createdAt: article.created_at,
    attachments,
  };
}

// A citação guarda autor + trecho, não o id: acha a mensagem original (anterior, cujo texto começa pelo
// trecho e cujo autor bate) para o portal poder rolar até ela. Não achou = o cartão fica sem link.
function linkQuotes(messages: TicketMessage[]): void {
  for (const message of messages) {
    if (!message.quote) continue;
    const quote = message.quote;
    const needle = quote.excerpt.replace(/…$/, "");
    const target = [...messages]
      .reverse()
      .find(
        (other) =>
          other.id < message.id &&
          (other.authorName === quote.author || other.role === "me") &&
          makeExcerpt(other.text, Number.MAX_SAFE_INTEGER).startsWith(needle),
      );
    quote.targetId = target?.id ?? null;
  }
}

async function buildAgentControls(
  ticket: ZammadExpandedTicket,
  requester: Requester,
  mode: ViewerMode,
  role: StaffRole,
  estimateChoices: EstimateOption[] | null,
  extra: { openChildren: number; childGroups: { id: number; label: string }[]; pauseReasons: FieldOption[]; hasDeadline: boolean },
): Promise<AgentControls | null> {
  if (mode !== "agent") return null;
  const meId = requester.zammadUser.id;
  const allocate = canAllocate(mode, role);
  const work = canWorkTicket(mode, ticket.owner_id, meId);
  const [options, assignees] = await Promise.all([loadAgentOptions(), allocate ? assigneesFor(ticket.group_id) : Promise.resolve([])]);
  const allStates = options.success ? options.data.states : [];

  // Fluxo da FEM: o seletor de estado só oferece o que esta pessoa pode fazer (como os Core Workflows na
  // tela do Zammad), e os atalhos viram botões coloridos. Fora do fluxo, a lista inteira, como antes.
  const step = flowStepOf(ticket.state);
  const actor = { supervisor: allocate, worker: work };
  let states = allStates;
  let flowActions: StaffFlowAction[] = [];
  let flowHint: string | null = null;
  let canAwaitReply = false;
  if (step) {
    const targets = allowedTargets(step, actor);
    canAwaitReply = targets.includes("aguardando_solicitante") && allStates.some((state) => flowStepOf(state.name) === "aguardando_solicitante");
    states = allStates.filter((state) => state.id === ticket.state_id || targets.includes(flowStepOf(state.name) as FlowStep));
    flowActions = staffActionsFor(step, actor).flatMap((action) => {
      const state = allStates.find((candidate) => flowStepOf(candidate.name) === action.target);
      // Pausar: o diálogo pede o motivo (opções do campo `motivo_pausa` do Zammad).
      const choice = action.target === "em_pausa" && extra.pauseReasons.length > 0 ? { field: PAUSE_REASON_FIELD, options: extra.pauseReasons } : null;
      return state ? [{ stateId: state.id, label: action.label, prompt: action.prompt, color: action.color, reason: action.reason, done: action.done, choice }] : [];
    });
    flowHint = staffHintFor(step, { ...actor, hasOwner: !isUnassigned(ticket.owner_id) });
    // Filho aberto bloqueia concluir o pai (o servidor também recusa, em agent-update-ticket).
    if (extra.openChildren > 0) {
      const blocked = (stateName: string) => flowStepOf(stateName) === "concluido";
      states = states.filter((state) => state.id === ticket.state_id || !blocked(state.name));
      flowActions = flowActions.filter((action) => !blocked(allStates.find((state) => state.id === action.stateId)?.name ?? ""));
      if (step === "em_andamento") flowHint = childrenBlockMessage(extra.openChildren);
    }
  }

  return {
    canWork: work,
    canAllocate: allocate,
    canEdit: canEditTicket(mode, role, ticket.owner_id, meId),
    ownerId: isUnassigned(ticket.owner_id) ? null : ticket.owner_id,
    assignees: assignees.map((person) => ({ id: person.id, name: person.name })),
    stateId: ticket.state_id,
    priorityId: ticket.priority_id,
    states: states.map(({ id, label, tone, needsPending }) => ({ id, label, tone, needsPending })),
    priorities: options.success ? options.data.priorities.map(({ id, label }) => ({ id, label })) : [],
    inFlow: step !== null,
    flowActions,
    flowHint,
    canComment: canCommentTicket(mode, role, ticket.owner_id, meId),
    canSetEstimate: estimateChoices !== null && canSetEstimate(mode, role),
    estimateOptions: estimateChoices ?? [],
    canAwaitReply,
    hasDeadline: extra.hasDeadline,
    canCreateChild: work || allocate,
    childGroups: work || allocate ? extra.childGroups : [],
  };
}

function toLinked(ticket: ZammadExpandedTicket, ownerNames: Map<number, string>): LinkedTicket {
  const state = describeState(ticket.state ?? "");
  return {
    id: ticket.id,
    number: String(ticket.number),
    title: ticket.title,
    group: formatGroupName(ticket.group),
    stateLabel: state.label,
    stateTone: state.tone,
    stateColor: state.color,
    closed: state.closed,
    ownerName: isUnassigned(ticket.owner_id) ? null : (ownerNames.get(ticket.owner_id as number) ?? null),
  };
}

export async function getTicket(requester: Requester, input: GetTicketInput): Promise<GetTicketResult> {
  const viewed = await loadTicketForViewer(requester, input.ticketId, Boolean(input.asAgent));
  if (!viewed.success) return viewed;
  const { ticket, mode, role } = viewed.data;
  const articles = await loadArticles(requester, input.ticketId, { includeInternal: mode === "agent" });
  if (!articles.success) return articles;

  const state = describeState(ticket.state ?? "");
  const avatars = await resolveAvatars(
    requester,
    articles.data.filter((article) => article.sender !== "System").map((article) => article.created_by_id),
  ).catch(() => new Map<number, string>());
  // Mensagem de sistema (ex.: "e-mail não enviado") é ruído interno; fica de fora.
  const messages = articles.data
    .map((article) => toMessage(article, { requester, avatars, customerId: ticket.customer_id, mode }))
    .filter((message) => message.role !== "system");
  linkQuotes(messages);

  const meId = requester.zammadUser.id;
  // Tempo previsto: opções do campo do Zammad (schema em cache). Sem o campo, a função some.
  const schema = await loadSchema();
  const estimateChoices = schema.success ? estimateOptions(schema.data.attributes) : null;
  const raw = ticket as unknown as Record<string, unknown>;
  const estimateValue = raw[ESTIMATE_FIELD];
  // Tempo previsto: só a equipe vê (no Zammad, o campo fica oculto para o cliente).
  const estimate =
    estimateChoices && mode === "agent"
      ? { value: estimateValue === null || estimateValue === undefined || estimateValue === "" ? null : String(estimateValue), label: estimateLabel(estimateChoices, estimateValue) }
      : null;
  const attributes = schema.success ? schema.data.attributes : [];
  const hasDeadline = attributes.some((attribute) => attribute.name === DEADLINE_FIELD && attribute.active);
  const deadlineLocal = hasDeadline ? deadlineToLocal(raw[DEADLINE_FIELD]) : null;
  const deadline = deadlineLocal ? { iso: new Date(String(raw[DEADLINE_FIELD])).toISOString(), local: deadlineLocal } : null;
  const pauseReasons = flattenOptions(attributes.find((attribute) => attribute.name === PAUSE_REASON_FIELD)?.data_option?.options).filter((option) => option.value !== "");
  const pauseValue = raw[PAUSE_REASON_FIELD];
  const pauseReason =
    mode === "agent" && flowStepOf(ticket.state) === "em_pausa" && pauseValue ? (pauseReasons.find((option) => option.value === String(pauseValue))?.label ?? String(pauseValue)) : null;
  // Vínculos pai/filho: só na visão da equipe (os filhos são internos; o solicitante do pai não os vê).
  const links = mode === "agent" ? await loadLinkedTickets(requester, ticket.id) : { parent: null, children: [] };
  const linkedOwners = await getPeople(
    [links.parent, ...links.children].flatMap((linked) => (linked && !isUnassigned(linked.owner_id) ? [linked.owner_id as number] : [])),
  );
  const ownerNames = new Map([...linkedOwners].map(([id, person]) => [id, person.name]));
  const children = links.children.map((child) => toLinked(child, ownerNames));
  const parentLinked = links.parent ? toLinked(links.parent, ownerNames) : null;
  const open = openChildren(children);
  const childGroups = schema.success ? childGroupOptions(schema.data.groups, ticket.group_id) : [];

  const [requesterPerson, ownerPerson, agent, canClose, tags, history, pluginNotes] = await Promise.all([
    ticket.customer_id === meId ? Promise.resolve(null) : getPerson(ticket.customer_id),
    ticket.owner_id && ticket.owner_id !== meId ? getPerson(ticket.owner_id) : Promise.resolve(null),
    buildAgentControls(ticket, requester, mode, role, estimateChoices, { openChildren: open, childGroups, pauseReasons, hasDeadline }),
    canManageTicketState(requester),
    // Tags são da equipe (marcas internas do fluxo): o solicitante não as vê.
    mode === "agent" ? loadTicketTags(requester, [ticket]).then((found) => found.get(ticket.id) ?? []) : Promise.resolve([] as string[]),
    // Histórico do Zammad (exige papel de agente): só na visão da equipe.
    mode === "agent" ? loadHistory(requester, ticket.id, estimateChoices) : Promise.resolve(null),
    // Notas do plugin (banco do Colabora): só a equipe; banco indisponível não derruba a tela.
    mode === "agent" ? loadPluginNotes(ticket.id) : Promise.resolve([]),
  ]);
  const unassigned = !ticket.owner_id || ticket.owner_id === 1;
  // Quem ABRIU o chamado decide sobre a entrega, mesmo sendo da equipe (gestor/agente que abriu o próprio
  // chamado vê o chamado na visão de equipe, mas continua sendo o solicitante).
  const isRequesterView = ticket.customer_id === meId;
  const customerActions: CustomerActionOption[] = isRequesterView
    ? customerActionsFor(state.step).map((key) => {
        const info = CUSTOMER_ACTIONS[key];
        return { key, label: info.label, prompt: info.prompt, color: info.color, reasonRequired: info.reasonRequired };
      })
    : [];
  const canReply = !state.step || customerCanReply(state.step);

  return {
    success: true,
    data: {
      history,
      id: ticket.id,
      number: String(ticket.number),
      title: ticket.title,
      group: formatGroupName(ticket.group),
      stateLabel: state.label,
      stateTone: state.tone,
      stateColor: state.color,
      closed: state.closed,
      flowStep: state.step,
      flowHint: state.step ? FLOW_STEPS[state.step].hint : null,
      customerActions,
      customerCanReply: canReply,
      customerReplyBlocked: canReply ? null : customerReplyBlockedMessage(state.step),
      awaitingYou: isAwaitingYou(ticket, state.closed) || (isRequesterView && customerMustDecide(state.step)),
      // Pela conversa (os artigos estão aqui): só mensagem do solicitante DEPOIS da última resposta pública da equipe, sem
      // contar a abertura, e nunca em chamado que o próprio responsável abriu ou que aguarda o solicitante.
      customerWaiting:
        !state.closed &&
        requesterRepliedAfterAgent(messages, { awaitingRequester: state.step === "aguardando_solicitante", ownerIsRequester: ticket.owner_id === ticket.customer_id }),
      canClose,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      priorityLabel: priorityLabel(ticket.priority ?? ""),
      viewer: mode,
      requester:
        ticket.customer_id === meId
          ? { name: requester.name ?? requester.email, email: requester.email }
          : { name: requesterPerson?.name ?? "Solicitante", email: requesterPerson?.email ?? null },
      owner: unassigned ? null : { name: ticket.owner_id === meId ? "Você" : (ownerPerson?.name ?? "Responsável") },
      assignedToMe: ticket.owner_id === meId,
      agent,
      tags,
      estimate,
      deadline,
      pauseReason,
      pluginNotes,
      parent: parentLinked,
      children,
      openChildren: open,
      messages,
    },
  };
}

async function loadPluginNotes(ticketId: number): Promise<{ text: string; createdAt: string }[]> {
  try {
    const notes = await listPluginNotes(ticketId, 5);
    return notes.map((note) => ({ text: note.note, createdAt: note.createdAt.toISOString() }));
  } catch {
    console.warn(`[colabora] notas do plugin indisponiveis (chamado ${ticketId})`);
    return [];
  }
}

// Histórico do chamado (ver shared/ticket-history.ts). Falha de leitura não derruba a tela: a seção some.
async function loadHistory(requester: Requester, ticketId: number, estimateChoices: EstimateOption[] | null): Promise<TicketHistoryEntry[] | null> {
  const result = await zammadRequest<RawHistory>(`ticket_history/${ticketId}`, { onBehalfOf: requester.email });
  if (!result.success) return null;
  const estimateLabels = Object.fromEntries((estimateChoices ?? []).map((option) => [option.value, option.label]));
  return toTicketHistory(result.data, { estimateField: ESTIMATE_FIELD, estimateLabels });
}
