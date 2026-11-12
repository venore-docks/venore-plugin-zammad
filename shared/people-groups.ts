import { z } from "zod";
import type { OperationResult } from "@venore/plugin-sdk";
import type { PeopleGroup, SectorAudience, WizardConfig } from "../contracts/types";
import { DEFAULT_AUDIENCE } from "./audience";
import { failure } from "./results";

// Grupos de pessoas (ex.: "TI", "RH"): decidem quais setores cada colaborador enxerga na abertura de
// chamados. Guardados no setting `colabora.groups` (leitura pública no core): SÓ ids de usuário.
// Tudo aqui é puro (sem servidor) para ser testado; a leitura/gravação do setting fica em wizard-config.ts.

export const MAX_GROUPS = 100;
export const MAX_MEMBERS = 1000;
export const MAX_NAME = 60;
export const MAX_DESCRIPTION = 200;
export const MAX_PASTED_EMAILS = 200;

export const peopleGroupSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(MAX_NAME),
  description: z
    .string()
    .max(MAX_DESCRIPTION)
    .nullable()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null)),
  memberIds: z.array(z.string().min(1).max(100)).max(MAX_MEMBERS),
  createdAt: z.string(),
});

export const peopleGroupsSchema = z.array(peopleGroupSchema).max(MAX_GROUPS);

// Tolerante: config antiga sem audiência, ou com audiência inválida, vira o padrão.
export const audienceSchema = z
  .object({
    mode: z.enum(["all", "groups", "inherit"]),
    groupIds: z.array(z.string().min(1).max(40)).max(MAX_GROUPS),
  })
  .catch(DEFAULT_AUDIENCE);

export function parsePeopleGroups(value: unknown): PeopleGroup[] {
  const parsed = peopleGroupsSchema.safeParse(value);
  return parsed.success ? parsed.data.map(dedupeMembers) : [];
}

function dedupeMembers(group: PeopleGroup): PeopleGroup {
  return { ...group, memberIds: [...new Set(group.memberIds)] };
}

export function newGroupId(existing: readonly string[], random: () => number = Math.random): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `g${Math.floor(random() * 36 ** 6)
      .toString(36)
      .padStart(6, "0")}`;
    if (!existing.includes(id)) return id;
  }
  return `g${Date.now().toString(36)}`;
}

export type GroupFields = { name: string; description?: string | null };

function validateFields(groups: readonly PeopleGroup[], fields: GroupFields, ignoreId: string | null): OperationResult<{ name: string; description: string | null }> {
  const name = fields.name.trim();
  if (name.length === 0) return failure("invalid_group_name", "Dê um nome ao grupo.");
  if (name.length > MAX_NAME) return failure("invalid_group_name", `O nome pode ter até ${MAX_NAME} caracteres.`);
  const description = fields.description?.trim() || null;
  if (description && description.length > MAX_DESCRIPTION) {
    return failure("invalid_group_description", `A descrição pode ter até ${MAX_DESCRIPTION} caracteres.`);
  }
  const duplicate = groups.some((group) => group.id !== ignoreId && group.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
  if (duplicate) return failure("duplicate_group_name", "Já existe um grupo com esse nome.");
  return { success: true, data: { name, description } };
}

export function createGroup(
  groups: readonly PeopleGroup[],
  fields: GroupFields,
  context: { now: Date; id?: string },
): OperationResult<{ groups: PeopleGroup[]; group: PeopleGroup }> {
  if (groups.length >= MAX_GROUPS) return failure("too_many_groups", `O limite é de ${MAX_GROUPS} grupos.`);
  const valid = validateFields(groups, fields, null);
  if (!valid.success) return valid;
  const group: PeopleGroup = {
    id: context.id ?? newGroupId(groups.map((entry) => entry.id)),
    name: valid.data.name,
    description: valid.data.description,
    memberIds: [],
    createdAt: context.now.toISOString(),
  };
  return { success: true, data: { groups: [...groups, group], group } };
}

export function updateGroup(groups: readonly PeopleGroup[], groupId: string, fields: GroupFields): OperationResult<{ groups: PeopleGroup[]; group: PeopleGroup }> {
  const current = groups.find((group) => group.id === groupId);
  if (!current) return failure("group_not_found", "Grupo não encontrado.");
  const valid = validateFields(groups, fields, groupId);
  if (!valid.success) return valid;
  const group = { ...current, name: valid.data.name, description: valid.data.description };
  return { success: true, data: { groups: groups.map((entry) => (entry.id === groupId ? group : entry)), group } };
}

export function deleteGroup(groups: readonly PeopleGroup[], groupId: string): OperationResult<PeopleGroup[]> {
  if (!groups.some((group) => group.id === groupId)) return failure("group_not_found", "Grupo não encontrado.");
  return { success: true, data: groups.filter((group) => group.id !== groupId) };
}

// Adiciona vários usuários de uma vez (sem repetir). `added` = quantos eram novos.
export function addMembers(
  groups: readonly PeopleGroup[],
  groupId: string,
  userIds: readonly string[],
): OperationResult<{ groups: PeopleGroup[]; added: string[] }> {
  const current = groups.find((group) => group.id === groupId);
  if (!current) return failure("group_not_found", "Grupo não encontrado.");
  const existing = new Set(current.memberIds);
  const added = [...new Set(userIds.map((id) => id.trim()).filter((id) => id.length > 0))].filter((id) => !existing.has(id));
  if (current.memberIds.length + added.length > MAX_MEMBERS) return failure("too_many_members", `O limite é de ${MAX_MEMBERS} pessoas por grupo.`);
  const group = { ...current, memberIds: [...current.memberIds, ...added] };
  return { success: true, data: { groups: groups.map((entry) => (entry.id === groupId ? group : entry)), added } };
}

export function removeMember(groups: readonly PeopleGroup[], groupId: string, userId: string): OperationResult<PeopleGroup[]> {
  const current = groups.find((group) => group.id === groupId);
  if (!current) return failure("group_not_found", "Grupo não encontrado.");
  const group = { ...current, memberIds: current.memberIds.filter((id) => id !== userId) };
  return { success: true, data: groups.map((entry) => (entry.id === groupId ? group : entry)) };
}

// --- referências nos setores (setting colabora.wizard) ---

function withAudience(config: WizardConfig, sectorKey: string, audience: SectorAudience, base: WizardConfig["groups"][string] | undefined): WizardConfig {
  const current = base ?? {
    enabled: true,
    audience: DEFAULT_AUDIENCE,
    label: null,
    description: null,
    bodyHint: null,
    order: null,
    fieldHelp: {},
    fieldSteps: {},
    stepTitles: {},
  };
  return { ...config, groups: { ...config.groups, [sectorKey]: { ...current, audience } } };
}

// Excluir um grupo de pessoas tira a referência dos setores. Um setor que só listava esse grupo fica com a
// lista vazia (oculto para todos, exceto admin): o admin enxerga isso na lista de setores.
export function removeGroupFromAudiences(config: WizardConfig, groupId: string): WizardConfig {
  let next = config;
  for (const [key, sector] of Object.entries(config.groups)) {
    if (!sector.audience.groupIds.includes(groupId)) continue;
    next = withAudience(next, key, { ...sector.audience, groupIds: sector.audience.groupIds.filter((id) => id !== groupId) }, sector);
  }
  return next;
}

// "Setores liberados" do grupo: marca/desmarca o grupo na audiência de cada setor. Marcar um setor que
// era "todos"/"herdar" passa a restringir a esse grupo; desmarcar o último grupo deixa o setor oculto.
export function setGroupSectors(config: WizardConfig, groupId: string, sectorIds: readonly number[]): WizardConfig {
  const wanted = new Set(sectorIds.map(String));
  let next = config;
  const keys = new Set([...Object.keys(config.groups), ...wanted]);
  for (const key of keys) {
    const sector = config.groups[key];
    const audience = sector?.audience ?? DEFAULT_AUDIENCE;
    const has = audience.mode === "groups" && audience.groupIds.includes(groupId);
    if (wanted.has(key) && !has) {
      const groupIds = audience.mode === "groups" ? [...audience.groupIds, groupId] : [groupId];
      next = withAudience(next, key, { mode: "groups", groupIds }, sector);
    } else if (!wanted.has(key) && has) {
      next = withAudience(next, key, { mode: "groups", groupIds: audience.groupIds.filter((id) => id !== groupId) }, sector);
    }
  }
  return next;
}

// Setores (chaves) cuja audiência própria lista o grupo.
export function sectorsUsingGroup(config: WizardConfig, groupId: string): number[] {
  return Object.entries(config.groups)
    .filter(([, sector]) => sector.audience.mode === "groups" && sector.audience.groupIds.includes(groupId))
    .map(([key]) => Number(key))
    .filter((id) => Number.isInteger(id));
}

// --- e-mails colados ---

const EMAIL_PATTERN = /^[^\s@<>()[\],;:]+@[^\s@<>()[\],;:]+\.[^\s@<>()[\],;:]+$/;

// Aceita e-mails separados por espaço, vírgula, ponto e vírgula ou quebra de linha (inclusive o formato
// "Nome <a@b.com>" colado do cliente de e-mail).
export function parsePastedEmails(text: string): { emails: string[]; invalid: string[]; truncated: boolean } {
  // "Nome Sobrenome <a@b.com>" vira só "a@b.com".
  const stripped = text.replace(/[^<>,;\n]*<([^<>]*)>/g, " $1 ");
  const tokens = stripped
    .split(/[\s,;]+/)
    .map((token) => token.replace(/^["']+|["']+$/g, "").trim())
    .filter((token) => token.length > 0);
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const email = token.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  const truncated = emails.length > MAX_PASTED_EMAILS;
  return { emails: emails.slice(0, MAX_PASTED_EMAILS), invalid, truncated };
}
