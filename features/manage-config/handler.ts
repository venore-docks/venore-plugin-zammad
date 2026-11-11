import type { OperationResult } from "@venore/plugin-sdk";
import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { ZAMMAD_PERMISSIONS } from "../../shared/permissions";
import { reloadSchema, saveAppName, saveGroupConfig, saveIntro } from "./service";
import type { ReloadSchemaResult, SaveAppNameInput, SaveConfigResult, SaveGroupConfigInput, SaveIntroInput } from "./types";

async function authorizeManager(): Promise<OperationResult<string>> {
  const authz = await authorizeActor(ZAMMAD_PERMISSIONS.settingsManage);
  if (!authz.authorized) return { success: false, error: authz.error };
  return { success: true, data: authz.actorId };
}

export async function saveGroupConfigHandler(input: SaveGroupConfigInput): Promise<SaveConfigResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return saveGroupConfig(actor.data, input);
}

export async function saveIntroHandler(input: SaveIntroInput): Promise<SaveConfigResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return saveIntro(actor.data, input);
}

export async function saveAppNameHandler(input: SaveAppNameInput): Promise<SaveConfigResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return saveAppName(actor.data, input);
}

export async function reloadSchemaHandler(): Promise<ReloadSchemaResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return reloadSchema();
}
