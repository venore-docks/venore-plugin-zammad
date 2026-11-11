"use server";

import { revalidatePath } from "next/cache";
import { isPluginActive } from "@venore/plugin-sdk";
import { agentUpdateTicket, changeTicketState, createTicket, replyTicket } from "../../index";
import type { AgentUpdateInput, AnswerValue, CreatedTicket, TicketAttachment } from "../../index";
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

function revalidateLists(): void {
  revalidatePath(PORTAL_SURFACE.list);
  revalidatePath(APP_SURFACE.list);
}

function revalidateTicket(ticketId: number): void {
  revalidateLists();
  revalidatePath(PORTAL_SURFACE.detail(ticketId));
  revalidatePath(APP_SURFACE.detail(ticketId));
}

// FormData: `payload` (JSON com groupId, title, description, answers) + `attachments` (arquivos).
export async function createTicketAction(formData: FormData): Promise<ZammadActionResult<CreatedTicket>> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };

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
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
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

export async function changeTicketStateAction(ticketId: number, action: "close" | "reopen"): Promise<ZammadActionResult<{ closed: boolean }>> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await changeTicketState({ ticketId, action });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(ticketId);
  return { ok: true, data: result.data };
}

// App do agente: estado, prioridade, assumir/devolver (vão juntos num único envio).
export async function agentUpdateTicketAction(input: AgentUpdateInput): Promise<ZammadActionResult<{ changed: string[] }>> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await agentUpdateTicket(input);
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateTicket(input.ticketId);
  return { ok: true, data: result.data };
}
