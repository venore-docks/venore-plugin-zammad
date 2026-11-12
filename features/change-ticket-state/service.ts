import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { canManageTicketState, loadOwnTicket, resolveStateId } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { describeState } from "../../shared/ticket-state";
import { zammadRequest } from "../../shared/zammad-client";
import type { ChangeTicketStateInput, ChangeTicketStateResult } from "./types";

export async function changeTicketState(requester: Requester, input: ChangeTicketStateInput): Promise<ChangeTicketStateResult> {
  const handle = beginOperation({ useCase: `colabora.${input.action}-ticket`, actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: ChangeTicketStateResult) => {
    endOperation(handle, result);
    return result;
  };
  if (input.action !== "close" && input.action !== "reopen") return finish(failure("invalid_action", "Ação inválida."));

  if (!(await canManageTicketState(requester))) {
    return finish(failure("forbidden_state_change", "Só a equipe do setor pode encerrar ou reabrir chamados. Para continuar o assunto, responda na conversa."));
  }
  const ticket = await loadOwnTicket(requester, input.ticketId);
  if (!ticket.success) return finish(ticket);
  const closed = describeState(ticket.data.state ?? "").closed;
  if (input.action === "close" && closed) return finish({ success: true, data: { closed: true } });
  if (input.action === "reopen" && !closed) return finish({ success: true, data: { closed: false } });

  const stateId = await resolveStateId(input.action === "close" ? "closed" : "new");
  if (!stateId.success) return finish(stateId);
  const updated = await zammadRequest(`tickets/${ticket.data.id}`, {
    method: "PUT",
    onBehalfOf: requester.email,
    body: { state_id: stateId.data },
  });
  if (!updated.success) return finish(updated);
  return finish({ success: true, data: { closed: input.action === "close" } });
}
