import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { UNASSIGNED_OWNER_ID, canWorkTicket } from "../../shared/access-rules";
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
  const { ticket, mode } = viewed.data;
  if (mode !== "agent") return finish(failure("not_agent", "Só agentes podem alterar o chamado por aqui."));

  const meId = requester.zammadUser.id;
  const body: Record<string, unknown> = {};
  const changed: string[] = [];

  if (input.owner === "me") {
    // Assumir: vale para a fila e para o que já é dele; chamado de outro agente nem chega aqui.
    if (ticket.owner_id !== meId) {
      body.owner_id = meId;
      changed.push("owner");
    }
  } else if (input.owner === "release") {
    if (!canWorkTicket(mode, ticket.owner_id, meId)) return finish(failure("not_owner", "Só quem está com o chamado pode devolvê-lo à fila."));
    body.owner_id = UNASSIGNED_OWNER_ID;
    changed.push("owner");
  }

  const wantsStateOrPriority = input.stateId !== undefined || input.priorityId !== undefined;
  if (wantsStateOrPriority) {
    // Estado e prioridade só com o chamado na mão do agente (assumir pode vir no mesmo envio).
    const willOwn = ticket.owner_id === meId || input.owner === "me";
    if (!willOwn) return finish(failure("not_owner", "Assuma o chamado antes de alterar estado ou prioridade."));
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
