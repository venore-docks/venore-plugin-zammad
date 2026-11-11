"use server";

import { revalidatePath } from "next/cache";
import { isPluginActive } from "@venore/plugin-sdk";
import { reloadSchema, saveAppName, saveGroupConfig, saveIntro } from "../../index";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const BASE_PATH = "/admin/zammad";
const DISABLED = "O plugin de chamados está desativado.";

export async function saveGroupConfigAction(groupId: number, config: unknown): Promise<AdminActionResult> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await saveGroupConfig({ groupId, config });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath(BASE_PATH);
  revalidatePath("/chamados/novo");
  return { ok: true };
}

export async function saveIntroAction(intro: string): Promise<AdminActionResult> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await saveIntro({ intro });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath(BASE_PATH);
  revalidatePath("/chamados/novo");
  return { ok: true };
}

export async function saveAppNameAction(appName: string): Promise<AdminActionResult> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await saveAppName({ appName });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath(BASE_PATH);
  return { ok: true };
}

export async function reloadSchemaAction(): Promise<AdminActionResult> {
  if (!(await isPluginActive("zammad"))) return { ok: false, error: DISABLED };
  const result = await reloadSchema();
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath(BASE_PATH);
  return { ok: true };
}
