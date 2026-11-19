import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { canAllocate, canWorkTicket } from "../../shared/access-rules";
import { escapeHtml, validateDescription, validateTitle } from "../../shared/answers";
import { childGroupOptions, childOrigin, isChildMode } from "../../shared/children";
import { assigneesFor } from "../../shared/directory";
import { flowStepOf } from "../../shared/flow";
import { loadAgentOptions, loadTicketForViewer } from "../../shared/own-ticket";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { loadSchema } from "../../shared/schema";
import { linkChild } from "../../shared/ticket-links";
import { zammadRequest } from "../../shared/zammad-client";
import type { CreateChildTicketInput, CreateChildTicketResult } from "./types";

type CreatedTicketResponse = { id: number; number: string | number };

// Cria um chamado filho e o vincula ao pai (docs/zammad-fem.md). Regras:
//   - quem pode: quem atende o pai (agente) ou o gestor do setor dele;
//   - o solicitante do filho é QUEM CRIOU (filho interno da equipe);
//   - subtarefa: mesmo setor, nasce Autorizado com responsável (gestor escolhe um agente do setor; agente fica
//     com ele mesmo) — o gatilho "Administrador atribui agente" leva a Em andamento;
//   - outro setor: nasce Novo no setor escolhido (fila do gestor de lá);
//   - a mensagem de abertura vai como do solicitante (`sender: Customer`), senão o Zammad a trata como resposta
//     de agente e tira o chamado de Novo.
export async function createChildTicket(requester: Requester, input: CreateChildTicketInput): Promise<CreateChildTicketResult> {
  const handle = beginOperation({ useCase: "colabora.create-child-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: CreateChildTicketResult) => {
    endOperation(handle, result);
    return result;
  };

  if (!isChildMode(input.mode)) return finish(failure("invalid_mode", "Escolha subtarefa ou outro setor."));
  const titleError = validateTitle(input.title);
  if (titleError) return finish(failure("invalid_title", titleError));
  const descriptionError = validateDescription(input.description);
  if (descriptionError) return finish(failure("invalid_description", descriptionError));

  const viewed = await loadTicketForViewer(requester, input.parentId, true);
  if (!viewed.success) return finish(viewed);
  const { ticket: parent, mode, role } = viewed.data;
  const meId = requester.zammadUser.id;
  const supervisor = canAllocate(mode, role);
  const worker = canWorkTicket(mode, parent.owner_id, meId);
  if (!supervisor && !worker) return finish(failure("forbidden_child", "Só quem atende este chamado ou o gestor do setor cria chamados filhos."));

  const payload: Record<string, unknown> = { title: input.title.trim(), customer_id: meId };
  if (input.mode === "subtask") {
    payload.group_id = parent.group_id;
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
  } else {
    const schema = await loadSchema();
    if (!schema.success) return finish(schema);
    const allowed = childGroupOptions(schema.data.groups, parent.group_id);
    if (!input.groupId || !allowed.some((group) => group.id === input.groupId)) {
      return finish(failure("invalid_group", "Escolha o setor que vai receber o chamado."));
    }
    payload.group_id = input.groupId;
  }

  const origin = childOrigin({ number: String(parent.number), title: parent.title });
  const paragraphs = input.description
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
  payload.article = {
    subject: input.title.trim(),
    body: `<p><em>${escapeHtml(origin)}</em></p>${paragraphs}`,
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
