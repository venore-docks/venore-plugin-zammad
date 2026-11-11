import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { UNASSIGNED_OWNER_ID, canAllocate, canEditTicket, isUnassigned } from "../../shared/access-rules";
import { assigneesFor } from "../../shared/directory";
import { loadAgentOptions, loadTicketForViewer } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { pendingTimeToIso, validatePending } from "../../shared/ticket-options";
import { zammadRequest } from "../../shared/zammad-client";
import type { AgentUpdateInput, AgentUpdateResult } from "./types";

export async function agentUpdateTicket(requester: Requester, input: AgentUpdateInput): Promise<AgentUpdateResult> {
  const handle = beginOperation({ useCase: "zammad.agent-update-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
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

  if (input.ownerId !== undefined) {
    // Alocar chamado é do gestor/admin — o agente comum não atribui nem devolve (nem a si mesmo).
    if (!canAllocate(mode, role)) return finish(failure("forbidden_allocation", "Só o gestor ou o admin pode atribuir chamados."));
    let target = UNASSIGNED_OWNER_ID;
    if (input.ownerId !== null) {
      const assignees = await assigneesFor(ticket.group_id);
      if (!assignees.some((person) => person.id === input.ownerId)) return finish(failure("invalid_assignee", "Essa pessoa não atende este setor."));
      target = input.ownerId;
    }
    const current = isUnassigned(ticket.owner_id) ? UNASSIGNED_OWNER_ID : (ticket.owner_id as number);
    if (target !== current) {
      body.owner_id = target;
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

  if (changed.length === 0) return finish({ success: true, data: { changed } });
  const updated = await zammadRequest(`tickets/${ticket.id}`, { method: "PUT", onBehalfOf: requester.email, body });
  if (!updated.success) return finish(updated);
  return finish({ success: true, data: { changed } });
}
