import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import {
  composeBody,
  toZammadValues,
  validateAttachments,
  validateDescription,
  validateFields,
  validateTitle,
} from "../../shared/answers";
import { buildSectorForms } from "../../shared/form";
import type { Requester } from "../../shared/requester";
import { failure } from "../../shared/results";
import { loadSchema } from "../../shared/schema";
import { readWizardConfig } from "../../shared/wizard-config";
import { readConnection, ticketUrl, zammadRequest } from "../../shared/zammad-client";
import type { CreateTicketInput, CreateTicketResult } from "./types";

type CreatedTicketResponse = { id: number; number: string };

export async function createTicket(requester: Requester, input: CreateTicketInput): Promise<CreateTicketResult> {
  const handle = beginOperation({ useCase: "zammad.create-ticket", actor: { id: requester.actorId, type: "user" }, kind: "write" });
  const finish = (result: CreateTicketResult) => {
    endOperation(handle, result);
    return result;
  };

  const schema = await loadSchema();
  if (!schema.success) return finish(schema);
  const config = await readWizardConfig();
  // O formulário é remontado aqui (nunca confiamos na lista de campos do navegador): mesmo setor,
  // mesmas regras, mesmos papéis da pessoa no Zammad.
  const { sectors } = buildSectorForms(schema.data, config, { roleIds: requester.zammadUser.role_ids });
  const sector = sectors.find((candidate) => candidate.groupId === input.groupId);
  if (!sector) return finish(failure("sector_unavailable", "Este setor não recebe chamados por aqui. Escolha outro."));

  const fields = sector.steps.flatMap((step) => step.fields);
  const titleError = validateTitle(input.title);
  if (titleError) return finish(failure("invalid_title", titleError));
  const descriptionError = validateDescription(input.description);
  if (descriptionError) return finish(failure("invalid_description", descriptionError));
  const fieldErrors = validateFields(fields, input.answers);
  const firstError = Object.entries(fieldErrors)[0];
  if (firstError) {
    const label = fields.find((field) => field.name === firstError[0])?.label ?? firstError[0];
    return finish(failure("invalid_answer", `"${label}": ${firstError[1]}`));
  }
  const attachmentError = validateAttachments(input.attachments);
  if (attachmentError) return finish(failure("invalid_attachments", attachmentError));

  const brand = await getBrandConfig();
  const title = input.title.trim();
  const payload = {
    title,
    group_id: sector.groupId,
    customer_id: requester.zammadUser.id,
    ...toZammadValues(fields, input.answers),
    article: {
      subject: title,
      body: composeBody(input.description, fields, input.answers, `Aberto pelo ${brand.siteName}.`),
      content_type: "text/html",
      type: "web",
      internal: false,
      attachments: input.attachments.map((file) => ({
        filename: file.filename,
        data: file.base64,
        "mime-type": file.mimeType || "application/octet-stream",
      })),
    },
  };

  const created = await zammadRequest<CreatedTicketResponse>("tickets", {
    method: "POST",
    body: payload,
    onBehalfOf: requester.email,
    timeoutMs: 45000,
  });
  if (!created.success) return finish(created);

  const connection = readConnection();
  const url = connection ? ticketUrl(connection.baseUrl, created.data.id) : "";
  return finish({ success: true, data: { id: created.data.id, number: String(created.data.number), url } });
}
