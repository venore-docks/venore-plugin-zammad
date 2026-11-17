import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { composeReplyBody } from "../../shared/answers";
import { CUSTOMER_ACTIONS, FLOW_STEPS, flowStepOf, isCustomerAction, validateReason } from "../../shared/flow";
import { loadOwnTicket } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { zammadRequest } from "../../shared/zammad-client";
import type { CustomerRespondInput, CustomerRespondResult } from "./types";

// Contrato com os gatilhos do Zammad da FEM (docs/zammad-fem.md): artigo `web`, remetente Cliente,
// público, com a palavra de controle no ASSUNTO e o texto legível no corpo. NUNCA manda `state_id`: o
// Zammad não protege o estado no servidor (os Core Workflows só valem na tela dele), então quem muda o
// estado são só os gatilhos — e a regra "o cliente nunca altera o estado" continua valendo.
export async function customerRespond(requester: Requester, input: CustomerRespondInput): Promise<CustomerRespondResult> {
  const handle = beginOperation({ useCase: "colabora.customer-respond", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: CustomerRespondResult) => {
    endOperation(handle, result);
    return result;
  };

  if (!isCustomerAction(input.action)) return finish(failure("invalid_action", "Ação inválida."));
  const info = CUSTOMER_ACTIONS[input.action];
  const reasonError = validateReason(input.reason, info.reasonRequired);
  if (reasonError) return finish(failure("invalid_reason", reasonError));

  // Só quem abriu o chamado decide sobre ele (404 igual para alheio).
  const ticket = await loadOwnTicket(requester, input.ticketId);
  if (!ticket.success) return finish(ticket);
  const step = flowStepOf(ticket.data.state);
  if (step !== info.from) {
    const current = step ? FLOW_STEPS[step].label : (ticket.data.state ?? "outro estado");
    return finish(failure("invalid_step", `Este chamado está em “${current}”: essa ação não vale mais. Recarregue a página.`));
  }

  const reason = (input.reason ?? "").trim();
  const text = reason || (input.action === "approve" ? "Aprovado." : info.label);
  const created = await zammadRequest<{ id: number }>("ticket_articles", {
    method: "POST",
    onBehalfOf: requester.email,
    timeoutMs: 45000,
    body: {
      ticket_id: ticket.data.id,
      subject: info.word,
      body: composeReplyBody(text, null),
      content_type: "text/html",
      type: "web",
      sender: "Customer",
      internal: false,
    },
  });
  if (!created.success) return finish(created);
  return finish({ success: true, data: { action: input.action, message: info.done } });
}
