"use server";

import { revalidatePath } from "next/cache";
import { isPluginActive } from "@venore/plugin-sdk";
import { changeTicketState, createTicket, replyTicket } from "../../index";
import type { AnswerValue, CreatedTicket, TicketAttachment } from "../../index";

// Toda action passa pelo handler do barrel (autorização + conta no Zammad lá dentro).
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
  revalidatePath("/chamados");
  return { ok: true, data: result.data };
}

// FormData: `ticketId`, `message` + `attachments`.
export async function replyTicketAction(formData: FormData): Promise<ZammadActionResult<{ reopened: boolean }>> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const ticketId = Number(formData.get("ticketId"));
  const result = await replyTicket({
    ticketId,
    message: String(formData.get("message") ?? ""),
    attachments: await readAttachments(formData),
  });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath("/chamados");
  revalidatePath(`/chamados/${ticketId}`);
  return { ok: true, data: result.data };
}

export async function changeTicketStateAction(ticketId: number, action: "close" | "reopen"): Promise<ZammadActionResult<{ closed: boolean }>> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await changeTicketState({ ticketId, action });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath("/chamados");
  revalidatePath(`/chamados/${ticketId}`);
  return { ok: true, data: result.data };
}
