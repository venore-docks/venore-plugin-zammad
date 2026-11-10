"use server";

import { revalidatePath } from "next/cache";
import { isPluginActive } from "@venore/plugin-sdk";
import { createTicket } from "../../index";
import type { AnswerValue, CreatedTicket, TicketAttachment } from "../../index";

// Toda action passa pelo handler do barrel (autorização + conta no Zammad lá dentro).
export type ZammadActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// FormData: `payload` (JSON com groupId, title, description, answers) + `attachments` (arquivos).
export async function createTicketAction(formData: FormData): Promise<ZammadActionResult<CreatedTicket>> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: "A abertura de chamados está desativada." };

  let payload: { groupId?: unknown; title?: unknown; description?: unknown; answers?: unknown };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Formulário inválido. Recarregue a página e tente de novo." };
  }

  const attachments: TicketAttachment[] = [];
  for (const entry of formData.getAll("attachments")) {
    if (typeof entry === "string" || entry.size === 0) continue;
    const bytes = Buffer.from(await entry.arrayBuffer());
    attachments.push({ filename: entry.name || "anexo", mimeType: entry.type, size: bytes.byteLength, base64: bytes.toString("base64") });
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
    attachments,
  });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath("/chamados");
  return { ok: true, data: result.data };
}
