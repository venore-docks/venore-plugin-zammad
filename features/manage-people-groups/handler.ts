import type { OperationResult } from "@venore/plugin-sdk";
import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { COLABORA_PERMISSIONS } from "../../shared/permissions";
import {
  addGroupMembers,
  addGroupMembersByEmail,
  createPeopleGroup,
  deletePeopleGroup,
  getPeopleGroup,
  listPeopleGroups,
  removeGroupMember,
  searchGroupCandidates,
  setGroupSectorsService,
  updatePeopleGroup,
} from "./service";
import type {
  AddMembersByEmailInput,
  AddMembersByEmailResult,
  AddMembersInput,
  AddMembersResult,
  CreatePeopleGroupResult,
  DeletePeopleGroupResult,
  GetPeopleGroupResult,
  GroupFieldsInput,
  GroupIdInput,
  ListPeopleGroupsResult,
  RemoveMemberInput,
  RemoveMemberResult,
  SearchCandidatesInput,
  SearchCandidatesResult,
  SetGroupSectorsInput,
  SetGroupSectorsResult,
  UpdateGroupInput,
  UpdatePeopleGroupResult,
} from "./types";

// Tudo aqui é do admin do plugin (`colabora.settings.manage`). O `searchUsers` do core NÃO autoriza sozinho:
// a autorização é este handler.
async function authorizeManager(): Promise<OperationResult<string>> {
  const authz = await authorizeActor(COLABORA_PERMISSIONS.settingsManage);
  if (!authz.authorized) return { success: false, error: authz.error };
  return { success: true, data: authz.actorId };
}

export async function listPeopleGroupsHandler(): Promise<ListPeopleGroupsResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return listPeopleGroups();
}

export async function getPeopleGroupHandler(input: GroupIdInput): Promise<GetPeopleGroupResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return getPeopleGroup(input);
}

export async function createPeopleGroupHandler(input: GroupFieldsInput): Promise<CreatePeopleGroupResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return createPeopleGroup(actor.data, input);
}

export async function updatePeopleGroupHandler(input: UpdateGroupInput): Promise<UpdatePeopleGroupResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return updatePeopleGroup(actor.data, input);
}

export async function deletePeopleGroupHandler(input: GroupIdInput): Promise<DeletePeopleGroupResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return deletePeopleGroup(actor.data, input);
}

export async function addGroupMembersHandler(input: AddMembersInput): Promise<AddMembersResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return addGroupMembers(actor.data, input);
}

export async function removeGroupMemberHandler(input: RemoveMemberInput): Promise<RemoveMemberResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return removeGroupMember(actor.data, input);
}

export async function searchGroupCandidatesHandler(input: SearchCandidatesInput): Promise<SearchCandidatesResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return searchGroupCandidates(input);
}

export async function addGroupMembersByEmailHandler(input: AddMembersByEmailInput): Promise<AddMembersByEmailResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return addGroupMembersByEmail(actor.data, input);
}

export async function setGroupSectorsHandler(input: SetGroupSectorsInput): Promise<SetGroupSectorsResult> {
  const actor = await authorizeManager();
  if (!actor.success) return actor;
  return setGroupSectorsService(actor.data, input);
}
