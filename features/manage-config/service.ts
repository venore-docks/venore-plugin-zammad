import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { failure } from "../../shared/results";
import { clearSchemaCache, loadSchema } from "../../shared/schema";
import { parseGroupConfig, readWizardConfig, writeWizardConfig } from "../../shared/wizard-config";
import type { ReloadSchemaResult, SaveAppNameInput, SaveConfigResult, SaveGroupConfigInput, SaveIntroInput } from "./types";

export async function saveGroupConfig(actorId: string, input: SaveGroupConfigInput): Promise<SaveConfigResult> {
  const handle = beginOperation({ useCase: "colabora.save-group-config", actor: { id: actorId, type: "user" }, kind: "write" });
  const finish = (result: SaveConfigResult) => {
    endOperation(handle, result);
    return result;
  };
  if (!Number.isInteger(input.groupId) || input.groupId <= 0) return finish(failure("invalid_group", "Setor inválido."));
  const parsed = parseGroupConfig(input.config);
  if (!parsed.success) return finish(parsed);
  const current = await readWizardConfig();
  return finish(await writeWizardConfig({ ...current, groups: { ...current.groups, [String(input.groupId)]: parsed.data } }));
}

export async function saveIntro(actorId: string, input: SaveIntroInput): Promise<SaveConfigResult> {
  const handle = beginOperation({ useCase: "colabora.save-intro", actor: { id: actorId, type: "user" }, kind: "write" });
  const current = await readWizardConfig();
  const result = await writeWizardConfig({ ...current, intro: input.intro?.trim() || null });
  endOperation(handle, result);
  return result;
}

export async function saveAppName(actorId: string, input: SaveAppNameInput): Promise<SaveConfigResult> {
  const handle = beginOperation({ useCase: "colabora.save-app-name", actor: { id: actorId, type: "user" }, kind: "write" });
  const current = await readWizardConfig();
  const result = await writeWizardConfig({ ...current, appName: input.appName?.trim() || null });
  endOperation(handle, result);
  return result;
}

export async function reloadSchema(): Promise<ReloadSchemaResult> {
  clearSchemaCache();
  const schema = await loadSchema({ fresh: true });
  if (!schema.success) return schema;
  return { success: true, data: { fetchedAt: schema.data.fetchedAt } };
}
