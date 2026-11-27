import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import { UNASSIGNED_OWNER_ID, canAllocate, canEditTicket, canSetEstimate, canWorkTicket } from "../../shared/access-rules";
import { composeReplyBody } from "../../shared/answers";
import { businessDaySeconds } from "../../shared/business-hours";
import { loadBusinessCalendar } from "../../shared/calendar";
import { childrenBlockMessage, openChildren } from "../../shared/children";
import { DEADLINE_FIELD, deadlineToZammad, defaultDeadline } from "../../shared/deadline";
import { assigneesFor } from "../../shared/directory";
import { DEFAULT_ESTIMATE, ESTIMATE_FIELD, estimateOptions, findEstimateKey, parseEstimate } from "../../shared/estimate";
import {
  AUTO_PAUSE_REASON,
  FLOW_STEPS,
  PAUSE_REASON_FIELD,
  canMoveTo,
  flowStepOf,
  inProgressToPause,
  staffActionFor,
  stepAfterOwnerChange,
  validateReason,
} from "../../shared/flow";
import { loadAgentOptions, loadTicketForViewer } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { loadSchema } from "../../shared/schema";
import { resolveAllocation } from "../../shared/team-rules";
import { loadLinkedTickets } from "../../shared/ticket-links";
import { searchOpenTicketsByOwner } from "../../shared/ticket-search";
import { pendingTimeToIso, validatePending } from "../../shared/ticket-options";
import { describeState } from "../../shared/ticket-state";
import { missingForChange } from "../../shared/transition";
import { flattenOptions } from "../../shared/workflow";
import { zammadRequest } from "../../shared/zammad-client";
import type { AgentUpdateInput, AgentUpdateOutcome, AgentUpdateResult } from "./types";

export async function agentUpdateTicket(requester: Requester, input: AgentUpdateInput): Promise<AgentUpdateResult> {
  const handle = beginOperation({ useCase: "colabora.agent-update-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: AgentUpdateResult) => {
    endOperation(handle, result);
    return result;
  };

  const viewed = await loadTicketForViewer(requester, input.ticketId, true);
  if (!viewed.success) return finish(viewed);
  const { ticket, mode, role } = viewed.data;
  if (mode !== "agent") return finish(failure("not_agent", "Só a equipe de atendimento pode alterar o chamado por aqui."));

  const meId = requester.zammadUser.id;
  const body: Record<string, unknown> = {};
  const changed: string[] = [];
  const outcome: AgentUpdateOutcome = { changed, paused: [], defaults: [] };

  if (input.ownerId !== undefined) {
    // Alocar chamado é do gestor/admin — o agente comum não atribui nem devolve (nem a si mesmo).
    if (!canAllocate(mode, role)) return finish(failure("forbidden_allocation", "Só o gestor ou o admin pode atribuir chamados."));
    const assignees = input.ownerId === null ? [] : await assigneesFor(ticket.group_id);
    const decision = resolveAllocation({ targetOwnerId: input.ownerId, currentOwnerId: ticket.owner_id, assignees, queueOwnerId: UNASSIGNED_OWNER_ID });
    if (!decision.ok) return finish(failure(decision.code, decision.message));
    if (decision.changed) {
      body.owner_id = decision.target;
      changed.push("owner");
    }
  }

  if (input.stateId !== undefined || input.priorityId !== undefined) {
    if (!canEditTicket(mode, role, ticket.owner_id, meId)) {
      return finish(failure("not_owner", "Só quem atende ou supervisiona este chamado altera estado ou prioridade."));
    }
    const options = await loadAgentOptions();
    if (!options.success) return finish(options);

    if (input.stateId !== undefined && input.stateId !== ticket.state_id) {
      const state = options.data.states.find((candidate) => candidate.id === input.stateId);
      if (!state) return finish(failure("invalid_state", "Estado inválido."));
      // Fluxo da FEM: a API do Zammad não aplica os Core Workflows de estado, então a regra de quem muda o quê
      // (600–607, 650/651) é repetida aqui. Fora do fluxo, vale o comportamento genérico.
      const currentStep = flowStepOf(ticket.state);
      if (currentStep) {
        const targetStep = flowStepOf(state.name);
        const actor = { supervisor: canAllocate(mode, role), worker: canWorkTicket(mode, ticket.owner_id, meId) };
        if (!targetStep || !canMoveTo(currentStep, targetStep, actor)) {
          return finish(failure("forbidden_transition", `Você não pode levar este chamado de “${FLOW_STEPS[currentStep].label}” para “${state.label}”.`));
        }
        // Pai não é concluído com chamado filho aberto (regra da FEM; a tela já esconde o botão).
        if (targetStep === "concluido") {
          const { children } = await loadLinkedTickets(requester, ticket.id);
          const open = openChildren(children.map((child) => ({ closed: describeState(child.state ?? "").closed })));
          if (open > 0) return finish(failure("children_open", childrenBlockMessage(open)));
        }
        const action = staffActionFor(targetStep, currentStep);
        const reasonError = validateReason(input.reason, action?.reason === "required");
        if (reasonError) return finish(failure("invalid_reason", reasonError));
        const reason = (input.reason ?? "").trim();
        // O texto vai como nota PÚBLICA no mesmo PUT: o gatilho de aviso ao cliente lê #{article.body_as_text}
        // ("Motivo:") e exige artigo público. Nota (não e-mail) para o cliente não receber dois e-mails.
        if (reason) {
          body.article = { subject: state.label, body: composeReplyBody(reason, null), content_type: "text/html", type: "note", internal: false };
        }
      }
      const pendingError = validatePending(state, input.pendingTime);
      if (pendingError) return finish(failure("invalid_pending", pendingError));
      body.state_id = state.id;
      if (state.needsPending) body.pending_time = pendingTimeToIso(input.pendingTime ?? "");
      changed.push("state");
    }
    if (input.priorityId !== undefined && input.priorityId !== ticket.priority_id) {
      if (!options.data.priorities.some((candidate) => candidate.id === input.priorityId)) {
        return finish(failure("invalid_priority", "Prioridade inválida."));
      }
      body.priority_id = input.priorityId;
      changed.push("priority");
    }
  }

  // Atribuído (v1.9.0): quem recebe um chamado Autorizado ainda não começou — o chamado vai para Atribuído e só
  // entra em Em andamento quando o agente inicia o atendimento. Devolver à fila um Atribuído volta a Autorizado.
  // Sem o estado "Atribuído" no Zammad, nada muda aqui (o gatilho do Zammad segue levando a Em andamento).
  const options = await loadAgentOptions();
  const states = options.success ? options.data.states : [];
  if (changed.includes("owner")) {
    const stateNow = typeof body.state_id === "number" ? states.find((state) => state.id === body.state_id)?.name : ticket.state;
    const next = stepAfterOwnerChange(flowStepOf(stateNow), body.owner_id !== UNASSIGNED_OWNER_ID);
    const nextState = next ? states.find((state) => flowStepOf(state.name) === next) : undefined;
    if (nextState && nextState.id !== ticket.state_id) {
      body.state_id = nextState.id;
      if (!changed.includes("state")) changed.push("state");
    }
  }

  const schema = await loadSchema();
  const attributes = schema.success ? schema.data.attributes : [];

  // Tempo previsto e prazo de entrega: só o gestor/admin do setor (no Zammad, os fluxos 613–616 fazem o mesmo na
  // tela dele; a API não os aplica, então a regra é repetida aqui). Opções = as do campo do Zammad.
  if (input.estimate !== undefined || input.deadline !== undefined) {
    if (!canSetEstimate(mode, role)) return finish(failure("forbidden_estimate", "Só o administrador do setor define o tempo previsto e o prazo."));
  }
  const estimateChoices = estimateOptions(attributes);
  const raw = ticket as unknown as Record<string, unknown>;
  if (input.estimate !== undefined) {
    if (!estimateChoices) return finish(failure("estimate_unavailable", "O Zammad não tem o campo de tempo previsto."));
    const parsed = parseEstimate(estimateChoices, input.estimate);
    if (!parsed.ok) return finish(failure("invalid_estimate", "Tempo previsto inválido."));
    if (parsed.value !== emptyToNull(raw[ESTIMATE_FIELD])) {
      body[ESTIMATE_FIELD] = parsed.value ?? "";
      changed.push("estimate");
    }
  }
  if (input.deadline !== undefined) {
    const value = input.deadline ? deadlineToZammad(input.deadline) : null;
    if (input.deadline && !value) return finish(failure("invalid_deadline", "Prazo de entrega inválido."));
    if (value !== emptyToNull(raw[DEADLINE_FIELD]) && !sameInstant(value, raw[DEADLINE_FIELD])) {
      body[DEADLINE_FIELD] = value;
      changed.push("deadline");
    }
  }

  // Campos que a mudança de estado EXIGE (Core Workflows da tela de edição; o Zammad recusa sem eles):
  // motivo da pausa vem do diálogo; tempo previsto e prazo, se ninguém definiu, ganham o padrão de 1 dia útil.
  const targetState = typeof body.state_id === "number" && body.state_id !== ticket.state_id ? states.find((state) => state.id === body.state_id) : undefined;
  const targetStep = targetState ? flowStepOf(targetState.name) : null;
  if (targetStep === "em_pausa") {
    const reasons = flattenOptions(attributes.find((attribute) => attribute.name === PAUSE_REASON_FIELD)?.data_option?.options).map((option) => option.value);
    const pauseReason = (input.pauseReason ?? "").trim();
    if (reasons.length > 0 && !reasons.includes(pauseReason)) return finish(failure("pause_reason_required", "Escolha o motivo da pausa."));
    if (pauseReason) body[PAUSE_REASON_FIELD] = pauseReason;
  }
  if (targetState && schema.success) {
    const missing = missingForChange(schema.data, raw, body, { roleIds: requester.zammadUser.role_ids, userId: meId });
    const unresolved: string[] = [];
    for (const field of missing) {
      if (field.name === ESTIMATE_FIELD && estimateChoices) {
        const key = findEstimateKey(estimateChoices, DEFAULT_ESTIMATE);
        if (key) {
          body[ESTIMATE_FIELD] = key;
          outcome.defaults.push("estimate");
          continue;
        }
      }
      if (field.name === DEADLINE_FIELD) {
        body[DEADLINE_FIELD] = defaultDeadline(new Date(), await loadBusinessCalendar());
        outcome.defaults.push("deadline");
        continue;
      }
      unresolved.push(field.label);
    }
    if (unresolved.length > 0) {
      return finish(failure("missing_fields", `Para mudar para “${targetState.label}”, o Zammad exige: ${unresolved.join(", ")}. Peça ao administrador do setor para preencher.`));
    }
  }

  if (changed.length === 0) return finish({ success: true, data: outcome });

  // Um agente tem UM chamado Em andamento: os outros dele são pausados (urgência) ANTES de este entrar. Se este
  // envio falhar, os pausados voltam (melhor esforço).
  const ownerId = (typeof body.owner_id === "number" ? body.owner_id : ticket.owner_id) ?? UNASSIGNED_OWNER_ID;
  const pauseState = states.find((state) => flowStepOf(state.name) === "em_pausa");
  const resumeId = targetState?.id;
  let pausedTickets: ZammadExpandedTicket[] = [];
  if (targetStep === "em_andamento" && ownerId !== UNASSIGNED_OWNER_ID && pauseState) {
    const owned = await searchOpenTicketsByOwner(requester, ownerId);
    if (!owned.success) return finish(owned);
    for (const other of inProgressToPause(owned.data, ticket.id)) {
      const paused = await zammadRequest(`tickets/${other.id}`, {
        method: "PUT",
        onBehalfOf: requester.email,
        body: { state_id: pauseState.id, [PAUSE_REASON_FIELD]: AUTO_PAUSE_REASON },
      });
      if (!paused.success) {
        await resume(requester, pausedTickets, resumeId);
        return finish(failure("auto_pause_failed", `Não foi possível pausar o chamado #${other.number}, que está em andamento: ${paused.error.message}`));
      }
      pausedTickets.push(other);
    }
  }

  const updated = await zammadRequest(`tickets/${ticket.id}`, { method: "PUT", onBehalfOf: requester.email, body });
  if (!updated.success) {
    await resume(requester, pausedTickets, resumeId);
    pausedTickets = [];
    return finish(updated);
  }
  outcome.paused = pausedTickets.map((other) => ({ id: other.id, number: String(other.number) }));
  return finish({ success: true, data: outcome });
}

// Desfaz a pausa automática (volta a Em andamento) quando o chamado novo não pôde iniciar.
async function resume(requester: Requester, tickets: readonly ZammadExpandedTicket[], inProgressStateId: number | undefined): Promise<void> {
  if (!inProgressStateId) return;
  for (const other of tickets) {
    await zammadRequest(`tickets/${other.id}`, { method: "PUT", onBehalfOf: requester.email, body: { state_id: inProgressStateId } });
  }
}

function emptyToNull(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function sameInstant(a: string | null, b: unknown): boolean {
  if (!a || typeof b !== "string" || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}
