import type { OperationResult } from "@venore/plugin-sdk";

// O que a UI recebe de cada pessoa: nome, e-mail e avatar saem do cadastro do portal (o setting guarda só ids).
export type PersonRef = { id: string; name: string | null; email: string; avatarUrl: string | null };

export type PeopleGroupSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  // Setores (grupos do Zammad) que listam este grupo na própria audiência.
  sectorIds: number[];
  createdAt: string;
};

export type PeopleGroupDetail = PeopleGroupSummary & {
  members: PersonRef[];
  // Ids que não existem mais no cadastro do portal (conta removida): a UI oferece limpar.
  missingMemberIds: string[];
};

export type GroupFieldsInput = { name: string; description?: string | null };
export type UpdateGroupInput = GroupFieldsInput & { groupId: string };
export type GroupIdInput = { groupId: string };
export type AddMembersInput = { groupId: string; userIds: string[] };
export type RemoveMemberInput = { groupId: string; userId: string };
export type AddMembersByEmailInput = { groupId: string; text: string };
export type SearchCandidatesInput = { groupId: string; query: string };
export type SetGroupSectorsInput = { groupId: string; sectorIds: number[] };

export type Candidate = PersonRef & { alreadyMember: boolean };
export type AddByEmailOutcome = {
  added: PersonRef[];
  alreadyMembers: string[];
  notFound: string[];
  invalid: string[];
  truncated: boolean;
};

export type ListPeopleGroupsResult = OperationResult<PeopleGroupSummary[]>;
export type GetPeopleGroupResult = OperationResult<PeopleGroupDetail>;
export type CreatePeopleGroupResult = OperationResult<PeopleGroupSummary>;
export type UpdatePeopleGroupResult = OperationResult<PeopleGroupSummary>;
export type DeletePeopleGroupResult = OperationResult<{ id: string }>;
export type AddMembersResult = OperationResult<{ added: number }>;
export type RemoveMemberResult = OperationResult<{ removed: string }>;
export type SearchCandidatesResult = OperationResult<Candidate[]>;
export type AddMembersByEmailResult = OperationResult<AddByEmailOutcome>;
export type SetGroupSectorsResult = OperationResult<{ sectorIds: number[] }>;
