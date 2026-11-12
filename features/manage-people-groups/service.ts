import { findUserByEmail, searchUsers } from "@venore/plugin-sdk/auth";
import { getMediaAssetUrls } from "@venore/plugin-sdk/media";
import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { OperationResult } from "@venore/plugin-sdk";
import type { PeopleGroup } from "../../contracts/types";
import {
  addMembers,
  createGroup,
  deleteGroup,
  parsePastedEmails,
  removeGroupFromAudiences,
  removeMember,
  sectorsUsingGroup,
  setGroupSectors,
  updateGroup,
} from "../../shared/people-groups";
import { failure } from "../../shared/results";
import { readPeopleGroups, readWizardConfig, writePeopleGroups, writeWizardConfig } from "../../shared/wizard-config";
import type {
  AddByEmailOutcome,
  AddMembersByEmailInput,
  AddMembersByEmailResult,
  AddMembersInput,
  AddMembersResult,
  Candidate,
  CreatePeopleGroupResult,
  DeletePeopleGroupResult,
  GetPeopleGroupResult,
  GroupFieldsInput,
  GroupIdInput,
  ListPeopleGroupsResult,
  PeopleGroupSummary,
  PersonRef,
  RemoveMemberInput,
  RemoveMemberResult,
  SearchCandidatesInput,
  SearchCandidatesResult,
  SetGroupSectorsInput,
  SetGroupSectorsResult,
  UpdateGroupInput,
  UpdatePeopleGroupResult,
} from "./types";

const AVATAR_WIDTH = 72;
const MAX_VISIBLE_MEMBERS = 300;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_LIMIT = 8;
const LOOKUP_BATCH = 20;

type Identity = { id: string; name: string | null; email: string; avatarMediaId: string | null; image: string | null };

async function toPersonRefs(identities: Identity[]): Promise<PersonRef[]> {
  const mediaIds = [...new Set(identities.map((identity) => identity.avatarMediaId).filter((id): id is string => Boolean(id)))];
  let urls: Record<string, string> = {};
  if (mediaIds.length > 0) {
    const resolved = await getMediaAssetUrls({ ids: mediaIds, displayWidth: AVATAR_WIDTH });
    if (resolved.success) urls = resolved.data;
  }
  return identities.map((identity) => ({
    id: identity.id,
    name: identity.name,
    email: identity.email,
    avatarUrl: (identity.avatarMediaId ? urls[identity.avatarMediaId] : undefined) ?? identity.image ?? null,
  }));
}

async function identityByEmail(email: string): Promise<(Identity & { status: string }) | null> {
  const found = await findUserByEmail({ email });
  if (!found.success) return null;
  const { id, name, image, avatarMediaId, status } = found.data;
  return { id, name, email: found.data.email, image, avatarMediaId, status };
}

// id → identidade (null = conta que não existe mais). `searchUsers` não traz avatar: o avatar vem do e-mail.
async function identityById(userId: string): Promise<Identity | null> {
  const found = await searchUsers({ id: userId, limit: 1 });
  const user = found.success ? found.data.entries[0] : undefined;
  if (!user) return null;
  return (await identityByEmail(user.email)) ?? { id: user.id, name: user.name, email: user.email, avatarMediaId: null, image: null };
}

async function inBatches<T, R>(items: readonly T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += LOOKUP_BATCH) {
    out.push(...(await Promise.all(items.slice(i, i + LOOKUP_BATCH).map(run))));
  }
  return out;
}

function summarize(group: PeopleGroup, sectorIds: number[]): PeopleGroupSummary {
  return { id: group.id, name: group.name, description: group.description, memberCount: group.memberIds.length, sectorIds, createdAt: group.createdAt };
}

async function audit<T>(actorId: string, useCase: string, run: () => Promise<OperationResult<T>>): Promise<OperationResult<T>> {
  const handle = beginOperation({ useCase: `colabora.${useCase}`, actor: { id: actorId, type: "user" }, kind: "write" });
  const result = await run();
  endOperation(handle, result);
  return result;
}

export async function listPeopleGroups(): Promise<ListPeopleGroupsResult> {
  const [groups, config] = await Promise.all([readPeopleGroups(), readWizardConfig()]);
  return { success: true, data: groups.map((group) => summarize(group, sectorsUsingGroup(config, group.id))) };
}

export async function getPeopleGroup(input: GroupIdInput): Promise<GetPeopleGroupResult> {
  const [groups, config] = await Promise.all([readPeopleGroups(), readWizardConfig()]);
  const group = groups.find((entry) => entry.id === input.groupId);
  if (!group) return failure("group_not_found", "Grupo não encontrado.");
  const shown = group.memberIds.slice(0, MAX_VISIBLE_MEMBERS);
  const identities = await inBatches(shown, identityById);
  const present = identities.filter((identity): identity is Identity => identity !== null);
  const members = (await toPersonRefs(present)).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "pt-BR"));
  const missingMemberIds = shown.filter((_, index) => identities[index] === null);
  return {
    success: true,
    data: { ...summarize(group, sectorsUsingGroup(config, group.id)), members, missingMemberIds },
  };
}

export async function createPeopleGroup(actorId: string, input: GroupFieldsInput): Promise<CreatePeopleGroupResult> {
  return audit(actorId, "create-people-group", async () => {
    const groups = await readPeopleGroups();
    const created = createGroup(groups, input, { now: new Date() });
    if (!created.success) return created;
    const saved = await writePeopleGroups(created.data.groups);
    if (!saved.success) return saved;
    return { success: true, data: summarize(created.data.group, []) };
  });
}

export async function updatePeopleGroup(actorId: string, input: UpdateGroupInput): Promise<UpdatePeopleGroupResult> {
  return audit(actorId, "update-people-group", async () => {
    const [groups, config] = await Promise.all([readPeopleGroups(), readWizardConfig()]);
    const updated = updateGroup(groups, input.groupId, input);
    if (!updated.success) return updated;
    const saved = await writePeopleGroups(updated.data.groups);
    if (!saved.success) return saved;
    return { success: true, data: summarize(updated.data.group, sectorsUsingGroup(config, input.groupId)) };
  });
}

// Exclui o grupo e limpa as referências nos setores. Grava os setores primeiro: se a segunda gravação falhar,
// sobra um grupo sem referências (inofensivo), nunca uma referência a um grupo que não existe.
export async function deletePeopleGroup(actorId: string, input: GroupIdInput): Promise<DeletePeopleGroupResult> {
  return audit(actorId, "delete-people-group", async () => {
    const [groups, config] = await Promise.all([readPeopleGroups(), readWizardConfig()]);
    const remaining = deleteGroup(groups, input.groupId);
    if (!remaining.success) return remaining;
    const cleaned = removeGroupFromAudiences(config, input.groupId);
    if (cleaned !== config) {
      const savedConfig = await writeWizardConfig(cleaned);
      if (!savedConfig.success) return savedConfig;
    }
    const saved = await writePeopleGroups(remaining.data);
    if (!saved.success) return saved;
    return { success: true, data: { id: input.groupId } };
  });
}

export async function addGroupMembers(actorId: string, input: AddMembersInput): Promise<AddMembersResult> {
  return audit(actorId, "add-group-members", async () => {
    const groups = await readPeopleGroups();
    const added = addMembers(groups, input.groupId, input.userIds);
    if (!added.success) return added;
    const saved = await writePeopleGroups(added.data.groups);
    if (!saved.success) return saved;
    return { success: true, data: { added: added.data.added.length } };
  });
}

export async function removeGroupMember(actorId: string, input: RemoveMemberInput): Promise<RemoveMemberResult> {
  return audit(actorId, "remove-group-member", async () => {
    const groups = await readPeopleGroups();
    const next = removeMember(groups, input.groupId, input.userId);
    if (!next.success) return next;
    const saved = await writePeopleGroups(next.data);
    if (!saved.success) return saved;
    return { success: true, data: { removed: input.userId } };
  });
}

// Busca de pessoas para adicionar (por nome ou e-mail). Só contas aprovadas.
export async function searchGroupCandidates(input: SearchCandidatesInput): Promise<SearchCandidatesResult> {
  const query = input.query.trim();
  if (query.length < SEARCH_MIN_LENGTH) return { success: true, data: [] };
  const [found, groups] = await Promise.all([searchUsers({ search: query, status: "approved", limit: SEARCH_LIMIT }), readPeopleGroups()]);
  if (!found.success) return found;
  const members = new Set(groups.find((group) => group.id === input.groupId)?.memberIds ?? []);
  const identities = await Promise.all(
    found.data.entries.map(async (user) => (await identityByEmail(user.email)) ?? { id: user.id, name: user.name, email: user.email, avatarMediaId: null, image: null }),
  );
  const people = await toPersonRefs(identities);
  const candidates: Candidate[] = people.map((person) => ({ ...person, alreadyMember: members.has(person.id) }));
  return { success: true, data: candidates };
}

// Cola de e-mails: adiciona quem tem conta aprovada no portal e informa o resto.
export async function addGroupMembersByEmail(actorId: string, input: AddMembersByEmailInput): Promise<AddMembersByEmailResult> {
  return audit(actorId, "add-group-members-by-email", async () => {
    const parsed = parsePastedEmails(input.text);
    if (parsed.emails.length === 0 && parsed.invalid.length === 0) return failure("no_emails", "Cole ao menos um e-mail.");
    const groups = await readPeopleGroups();
    const group = groups.find((entry) => entry.id === input.groupId);
    if (!group) return failure("group_not_found", "Grupo não encontrado.");

    const looked = await inBatches(parsed.emails, async (email) => ({ email, identity: await identityByEmail(email) }));
    const existing = new Set(group.memberIds);
    const outcome: AddByEmailOutcome = { added: [], alreadyMembers: [], notFound: [], invalid: parsed.invalid, truncated: parsed.truncated };
    const toAdd: Identity[] = [];
    const queued = new Set<string>();
    for (const { email, identity } of looked) {
      if (!identity || identity.status !== "approved") outcome.notFound.push(email);
      else if (existing.has(identity.id)) outcome.alreadyMembers.push(email);
      else if (!queued.has(identity.id)) {
        queued.add(identity.id);
        toAdd.push(identity);
      }
    }

    if (toAdd.length > 0) {
      const added = addMembers(groups, input.groupId, toAdd.map((identity) => identity.id));
      if (!added.success) return added;
      const saved = await writePeopleGroups(added.data.groups);
      if (!saved.success) return saved;
      outcome.added = await toPersonRefs(toAdd);
    }
    return { success: true, data: outcome };
  });
}

// "Setores liberados": marca/desmarca o grupo na audiência dos setores (setting colabora.wizard).
export async function setGroupSectorsService(actorId: string, input: SetGroupSectorsInput): Promise<SetGroupSectorsResult> {
  return audit(actorId, "set-group-sectors", async () => {
    const [groups, config] = await Promise.all([readPeopleGroups(), readWizardConfig()]);
    if (!groups.some((group) => group.id === input.groupId)) return failure("group_not_found", "Grupo não encontrado.");
    const sectorIds = [...new Set(input.sectorIds)].filter((id) => Number.isInteger(id) && id > 0);
    const next = setGroupSectors(config, input.groupId, sectorIds);
    if (next !== config) {
      const saved = await writeWizardConfig(next);
      if (!saved.success) return saved;
    }
    return { success: true, data: { sectorIds: sectorsUsingGroup(next, input.groupId) } };
  });
}
