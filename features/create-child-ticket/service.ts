import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { composeBody, escapeHtml, toZammadValues, validateDescription, validateFields, validateTitle } from "../../shared/answers";
import { resolveChildTarget } from "../../shared/child-target";
import { childOrigin } from "../../shared/children";
import { assigneesFor } from "../../shared/directory";
import { flowStepOf } from "../../shared/flow";
import { loadAgentOptions } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { linkChild } from "../../shared/ticket-links";
import { zammadRequest } from "../../shared/zammad-client";
import type { CreateChildTicketInput, CreateChildTicketResult } from "./types";

type CreatedTicketResponse = { id: number; number: string | number };

// Cria um chamado filho e o vincula ao pai (docs/zammad-fem.md). Regras:
//   - quem pode: quem atende o pai (agente) ou o gestor do setor dele (resolveChildTarget);
//   - o solicitante do filho é QUEM CRIOU (filho interno da equipe);
//   - subtarefa: mesmo setor, nasce Autorizado com responsável (gestor escolhe um agente do setor; agente fica
//     com ele mesmo) — o gatilho "Administrador atribui agente" leva a Em andamento;
//   - outro setor: nasce Novo no setor escolhido (folha; fila do gestor de lá);
//   - os campos customizados do setor de destino vêm do Zammad (schema + Core Workflows) e são remontados AQUI,
//     nunca a partir da lista do navegador; o Zammad recusa o chamado sem os obrigatórios;
//   - a mensagem de abertura vai como do solicitante (`sender: Customer`), senão o Zammad a trata como resposta
//     de agente e tira o chamado de Novo.
export async function createChildTicket(requester: Requester, input: CreateChildTicketInput): Promise<CreateChildTicketResult> {
  const handle = beginOperation({ useCase: "colabora.create-child-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: CreateChildTicketResult) => {
    endOperation(handle, result);
    return result;
  };

  const titleError = validateTitle(input.title);
  if (titleError) return finish(failure("invalid_title", titleError));
  const descriptionError = validateDescription(input.description);
  if (descriptionError) return finish(failure("invalid_description", descriptionError));

  const target = await resolveChildTarget(requester, input);
  if (!target.success) return finish(target);
  const { parent, supervisor, groupId, form } = target.data;
  const meId = requester.zammadUser.id;

  const answers = input.answers ?? {};
  const fieldErrors = validateFields(form.fields, answers);
  const firstError = Object.entries(fieldErrors)[0];
  if (firstError) {
    const label = form.fields.find((field) => field.name === firstError[0])?.label ?? firstError[0];
    return finish(failure("invalid_answer", `"${label}": ${firstError[1]}`));
  }

  const title = input.title.trim();
  const payload: Record<string, unknown> = { title, customer_id: meId, group_id: groupId, ...toZammadValues(form.fields, answers) };
  if (input.mode === "subtask") {
    let ownerId = meId;
    if (supervisor && input.ownerId) {
      const assignees = await assigneesFor(parent.group_id);
      if (!assignees.some((person) => person.id === input.ownerId)) {
        return finish(failure("invalid_assignee", "Esta pessoa não atende o setor deste chamado."));
      }
      ownerId = input.ownerId;
    }
    payload.owner_id = ownerId;
    // Subtarefa já nasce autorizada (o pai foi autorizado). Fora do fluxo da FEM, fica no estado padrão.
    const options = await loadAgentOptions();
    const authorized = options.success ? options.data.states.find((state) => flowStepOf(state.name) === "autorizado") : undefined;
    if (authorized) payload.state_id = authorized.id;
  }

  // Primeira linha: de onde o filho veio. Depois, a descrição e o resumo das respostas (mesmo formato da abertura,
  // que o portal extrai com extractFormAnswers).
  const brand = await getBrandConfig();
  const origin = childOrigin({ number: String(parent.number), title: parent.title });
  payload.article = {
    subject: title,
    body: `<p><em>${escapeHtml(origin)}</em></p>${composeBody(input.description, form.fields, answers, `Aberto pelo ${brand.siteName}.`)}`,
    content_type: "text/html",
    type: "web",
    sender: "Customer",
    internal: false,
  };

  const created = await zammadRequest<CreatedTicketResponse>("tickets", { method: "POST", body: payload, onBehalfOf: requester.email, timeoutMs: 45000 });
  if (!created.success) return finish(created);
  const child = { id: created.data.id, number: String(created.data.number) };

  const linked = await linkChild(requester, parent.id, child);
  if (!linked.success) {
    return finish(failure("link_failed", `O chamado #${child.number} foi criado, mas não foi possível vinculá-lo ao pai: ${linked.error.message}`));
  }
  return finish({ success: true, data: child });
}
