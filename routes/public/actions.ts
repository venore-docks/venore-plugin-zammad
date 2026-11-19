"use server";

import { revalidatePath } from "next/cache";
import { isPluginActive } from "@venore/plugin-sdk";
import { agentUpdateTicket, changeTicketState, createChildTicket, createTicket, customerRespond, getTicket, replyTicket, searchViewAsTargets, startViewAs, stopViewAs } from "../../index";
import type { AgentUpdateInput, AnswerValue, CreateChildTicketInput, CreatedTicket, CustomerRespondInput, TicketAttachment, ViewAsPerson } from "../../index";
import { APP_SURFACE, PORTAL_SURFACE } from "../../shared/routes";

// Toda action passa pelo handler do barrel (autorização + conta no Zammad lá dentro). Servem às DUAS
// superfícies (portal e app): ao mudar um chamado, as duas são revalidadas.
export type ZammadActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const DISABLED = "A abertura de chamados está desativada.";

async function readAttachments(formData: FormData): Promise<TicketAttachment[]> {
  const attachments: TicketAttachment[] = [];
  for (const entry of formData.getAll("attachments")) {
    if (typeof entry === "string" || entry.size === 0) continue;
    const bytes = Buffer.from(await entry.arrayBuffer());
    attachments.push({ filename: entry.name || "anexo", mimeType: entry.type, size: bytes.byteLength, base64: bytes.toString("base64") });
  }
  return attachments;
}

// Tudo que mostra listas ou contagens de chamados, nas DUAS superfícies (portal e app).
function revalidateLists(): void {
  for (const surface of [PORTAL_SURFACE, APP_SURFACE]) {
    revalidatePath(surface.home);
    revalidatePath(surface.mine);
    revalidatePath(surface.assigned);
    revalidatePath(surface.queue);
    revalidatePath(surface.team);
  }
}

function revalidateTicket(ticketId: number): void {
  revalidateLists();
  revalidatePath(PORTAL_SURFACE.detail(ticketId));
  revalidatePath(APP_SURFACE.detail(ticketId));
}

// FormData: `payload` (JSON com groupId, title, description, answers) + `attachments` (arquivos).
export async function createTicketAction(formData: FormData): Promise<ZammadActionResult<CreatedTicket>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };

  let payload: { groupId?: unknown; title?: unknown; description?: unknown; answers?: unknown };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Formulário inválido. Recarregue a página e tente de novo." };
  }

  const answers =
    payload.answers && typeof payload.answers === "object" && !Array.isArray(payload.answers)
      ? (payload.answers as Record<string, AnswerValue | null>)
      : {};
  const result = await createTicket({
    groupId: Number(payload.groupId),
    title: String(payload.title ?? ""),
    description: String(payload.description ?? ""),
    answers,
    attachments: await readAttachments(formData),
  });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateLists();
  return { ok: true, data: result.data };
}

// FormData: `ticketId`, `message`, `quoteArticleId?`, `asAgent?` ("1"), `internal?` ("1") + `attachments`.
export async function replyTicketAction(formData: FormData): Promise<ZammadActionResult<{ reopened: boolean }>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const ticketId = Number(formData.get("ticketId"));
  const quoteId = Number(formData.get("quoteArticleId"));
  const result = await replyTicket({
    ticketId,
    quoteArticleId: Number.isInteger(quoteId) && quoteId > 0 ? quoteId : null,
    message: String(formData.get("message") ?? ""),
    attachments: await readAttachments(formData),
    asAgent: formData.get("asAgent") === "1",
    internal: formData.get("internal") === "1",
  });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(ticketId);
  return { ok: true, data: result.data };
}

// Resumo de um chamado para o diálogo "Analisar" da fila do gestor (carregado só quando o diálogo abre).
export type TicketPreview = {
  id: number;
  number: string;
  title: string;
  group: string;
  requesterName: string;
  createdAt: string;
  priorityLabel: string;
  stateLabel: string;
  text: string;
  answers: { label: string; value: string }[];
  attachments: number;
};

export async function ticketPreviewAction(ticketId: number): Promise<ZammadActionResult<TicketPreview>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await getTicket({ ticketId: Number(ticketId), asAgent: true });
  if (!result.success) return { ok: false, error: result.error.message };
  const ticket = result.data;
  const first = ticket.messages.find((message) => !message.internal) ?? ticket.messages[0] ?? null;
  return {
    ok: true,
    data: {
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      group: ticket.group,
      requesterName: ticket.requester.name,
      createdAt: ticket.createdAt,
      priorityLabel: ticket.priorityLabel,
      stateLabel: ticket.stateLabel,
      text: first?.text ?? "",
      answers: first?.answers ?? [],
      attachments: ticket.messages.reduce((total, message) => total + message.attachments.length, 0),
    },
  };
}

// Chamado filho (subtarefa no mesmo setor ou pedido a outro setor), vinculado ao chamado atual.
export async function createChildTicketAction(input: CreateChildTicketInput): Promise<ZammadActionResult<{ id: number; number: string }>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await createChildTicket({
    parentId: Number(input.parentId),
    mode: input.mode,
    groupId: input.groupId ? Number(input.groupId) : null,
    ownerId: input.ownerId ? Number(input.ownerId) : null,
    title: String(input.title ?? ""),
    description: String(input.description ?? ""),
  });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(Number(input.parentId));
  revalidateTicket(result.data.id);
  return { ok: true, data: result.data };
}

// Decisão do solicitante no fluxo da FEM (aprovar, pedir ajustes, rejeitar, não resolvido, reenviar).
export async function customerRespondAction(input: CustomerRespondInput): Promise<ZammadActionResult<{ message: string }>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await customerRespond({ ticketId: Number(input.ticketId), action: input.action, reason: input.reason ?? null });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(Number(input.ticketId));
  return { ok: true, data: { message: result.data.message } };
}

export async function changeTicketStateAction(ticketId: number, action: "close" | "reopen"): Promise<ZammadActionResult<{ closed: boolean }>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await changeTicketState({ ticketId, action });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(ticketId);
  return { ok: true, data: result.data };
}

// "Ver como" (só leitura; só admin do Colabora). Ao ligar/desligar, tudo que depende de quem vê é revalidado.
export async function searchViewAsAction(query: string): Promise<ZammadActionResult<ViewAsPerson[]>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await searchViewAsTargets(String(query ?? ""));
  return result.success ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function startViewAsAction(targetId: string): Promise<ZammadActionResult<ViewAsPerson>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await startViewAs(String(targetId ?? ""));
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateLists();
  return { ok: true, data: result.data };
}

export async function stopViewAsAction(): Promise<ZammadActionResult<null>> {
  await stopViewAs();
  revalidateLists();
  return { ok: true, data: null };
}

// App do agente: estado, prioridade, assumir/devolver (vão juntos num único envio).
export async function agentUpdateTicketAction(input: AgentUpdateInput): Promise<ZammadActionResult<{ changed: string[] }>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await agentUpdateTicket(input);
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(input.ticketId);
  return { ok: true, data: result.data };
}
