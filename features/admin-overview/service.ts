import { staffRoleOf } from "../../shared/access-rules";
import { audienceBadge } from "../../shared/audience";
import { loadDirRoles, loadDirUsers } from "../../shared/directory";
import { buildSectorForms, groupConfigFor } from "../../shared/form";
import { sectorsUsingGroup } from "../../shared/people-groups";
import { getTokenOwner, loadSchema } from "../../shared/schema";
import { readPeopleGroups, readWizardConfig } from "../../shared/wizard-config";
import { readConnection } from "../../shared/zammad-client";
import type { PeopleGroupSummary } from "../manage-people-groups/types";
import type { AdminOverview, AdminOverviewInput, GetAdminOverviewResult, StaffCounts } from "./types";

async function loadStaffCounts(): Promise<StaffCounts | null> {
  const [users, roles] = await Promise.all([loadDirUsers(), loadDirRoles()]);
  if (!users || !roles) return null;
  const counts: StaffCounts = { agents: 0, managers: 0, admins: 0 };
  for (const user of users) {
    if (!user.active) continue;
    const mine = new Set(user.roleIds);
    const role = staffRoleOf(roles.filter((candidate) => mine.has(candidate.id)).map((candidate) => candidate.permissions));
    if (role === "agent") counts.agents += 1;
    else if (role === "manager") counts.managers += 1;
    else if (role === "admin") counts.admins += 1;
  }
  return counts;
}

export async function getAdminOverview(input: AdminOverviewInput = {}): Promise<GetAdminOverviewResult> {
  const level = input.level ?? "full";
  const [config, groups] = await Promise.all([readWizardConfig(), readPeopleGroups()]);
  const peopleGroups: PeopleGroupSummary[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount: group.memberIds.length,
    sectorIds: sectorsUsingGroup(config, group.id),
    createdAt: group.createdAt,
  }));

  const base: AdminOverview = {
    connection: { configured: false },
    schemaFetchedAt: null,
    intro: config.intro,
    appName: config.appName,
    sectors: [],
    peopleGroups,
    staff: null,
    unsupported: [],
    skippedFields: [],
  };
  if (level === "config") return { success: true, data: base };

  const connection = readConnection();
  if (!connection) return { success: true, data: base };

  const [owner, schema, staff] = await Promise.all([
    level === "full" ? getTokenOwner() : Promise.resolve(null),
    loadSchema(),
    level === "full" ? loadStaffCounts() : Promise.resolve(null),
  ]);
  const tokenOwner =
    owner && owner.success
      ? { name: [owner.data.firstname, owner.data.lastname].filter(Boolean).join(" ") || owner.data.email, email: owner.data.email }
      : null;
  const error = owner && !owner.success ? owner.error.message : !schema.success ? schema.error.message : null;

  const overview: AdminOverview = {
    ...base,
    connection: { configured: true, baseUrl: connection.baseUrl, tokenOwner, error },
    schemaFetchedAt: schema.success ? schema.data.fetchedAt : null,
    staff,
  };
  if (!schema.success) return { success: true, data: overview };

  // Sem `viewer`: lista todos os setores (o admin vê tudo, inclusive os ocultos e os restritos).
  const built = buildSectorForms(schema.data, config, { includeDisabled: true });
  const groupNames = new Map(schema.data.groups.map((group) => [group.id, group.name]));
  const tree = built.sectors.map((sector) => ({ groupId: sector.groupId, parentId: sector.parentId }));
  overview.unsupported = built.unsupported;
  overview.skippedFields = built.skippedFields;
  overview.sectors = built.sectors.map((sector) => ({
    groupId: sector.groupId,
    zammadName: groupNames.get(sector.groupId) ?? sector.label,
    parentId: sector.parentId,
    config: groupConfigFor(config, sector.groupId),
    stepCount: sector.steps.length,
    audience: audienceBadge(sector.groupId, tree, config, groups),
    fields: sector.steps.flatMap((step) =>
      step.fields.map((field) => ({ name: field.name, label: field.label, type: field.type, required: field.required })),
    ),
  }));
  return { success: true, data: overview };
}
