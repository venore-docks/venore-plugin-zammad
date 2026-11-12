"use server";

import { revalidatePath } from "next/cache";
import { isPluginActive } from "@venore/plugin-sdk";
import type { OperationResult } from "@venore/plugin-sdk";
import {
  addGroupMembersByEmailHandler,
  addGroupMembersHandler,
  createPeopleGroupHandler,
  deletePeopleGroupHandler,
  removeGroupMemberHandler,
  searchGroupCandidatesHandler,
  setGroupSectorsHandler,
  updatePeopleGroupHandler,
} from "../../features/manage-people-groups/handler";
import type { AddByEmailOutcome, Candidate, PeopleGroupSummary } from "../../features/manage-people-groups/types";
import { reloadSchemaHandler, saveAppNameHandler, saveGroupConfigHandler, saveIntroHandler } from "../../features/manage-config/handler";

// Resultado das actions: `data` só nas que devolvem algo. A autorização é de cada handler (settings.manage).
export type AdminActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const BASE_PATH = "/admin/colabora";
const DISABLED = "O plugin Colabora está desativado.";

function refreshAdmin() {
  revalidatePath(BASE_PATH, "layout");
}

// O que as pessoas veem muda com setores, textos e audiência: revalida as duas superfícies.
function refreshWizard() {
  refreshAdmin();
  revalidatePath("/colabora/novo");
  revalidatePath("/ext/colabora/app/novo");
}

async function run<T, R>(operation: () => Promise<OperationResult<T>>, map: (data: T) => R, after: () => void = refreshAdmin): Promise<AdminActionResult<R>> {
  if (!(await isPluginActive("colabora"))) return { ok: false, error: DISABLED };
  const result = await operation();
  if (!result.success) return { ok: false, error: result.error.message };
  after();
  return { ok: true, data: map(result.data) };
}

const nothing = () => undefined;

// --- setores, textos e app ---

export async function saveGroupConfigAction(groupId: number, config: unknown): Promise<AdminActionResult> {
  return run(() => saveGroupConfigHandler({ groupId, config }), nothing, refreshWizard);
}

export async function saveIntroAction(intro: string): Promise<AdminActionResult> {
  return run(() => saveIntroHandler({ intro }), nothing, refreshWizard);
}

export async function saveAppNameAction(appName: string): Promise<AdminActionResult> {
  return run(() => saveAppNameHandler({ appName }), nothing);
}

export async function reloadSchemaAction(): Promise<AdminActionResult> {
  return run(() => reloadSchemaHandler(), nothing, refreshWizard);
}

// --- grupos de pessoas ---

export async function createPeopleGroupAction(name: string, description: string): Promise<AdminActionResult<PeopleGroupSummary>> {
  return run(() => createPeopleGroupHandler({ name, description }), (data) => data);
}

export async function updatePeopleGroupAction(groupId: string, name: string, description: string): Promise<AdminActionResult<PeopleGroupSummary>> {
  return run(() => updatePeopleGroupHandler({ groupId, name, description }), (data) => data);
}

export async function deletePeopleGroupAction(groupId: string): Promise<AdminActionResult> {
  return run(() => deletePeopleGroupHandler({ groupId }), nothing, refreshWizard);
}

export async function addGroupMembersAction(groupId: string, userIds: string[]): Promise<AdminActionResult<{ added: number }>> {
  return run(() => addGroupMembersHandler({ groupId, userIds }), (data) => data, refreshWizard);
}

export async function removeGroupMemberAction(groupId: string, userId: string): Promise<AdminActionResult> {
  return run(() => removeGroupMemberHandler({ groupId, userId }), nothing, refreshWizard);
}

export async function searchGroupCandidatesAction(groupId: string, query: string): Promise<AdminActionResult<Candidate[]>> {
  return run(() => searchGroupCandidatesHandler({ groupId, query }), (data) => data, () => undefined);
}

export async function addGroupMembersByEmailAction(groupId: string, text: string): Promise<AdminActionResult<AddByEmailOutcome>> {
  return run(() => addGroupMembersByEmailHandler({ groupId, text }), (data) => data, refreshWizard);
}

export async function setGroupSectorsAction(groupId: string, sectorIds: number[]): Promise<AdminActionResult<{ sectorIds: number[] }>> {
  return run(() => setGroupSectorsHandler({ groupId, sectorIds }), (data) => data, refreshWizard);
}
