import { buildSectorForms, groupConfigFor } from "../../shared/form";
import { getTokenOwner, loadSchema } from "../../shared/schema";
import { readWizardConfig } from "../../shared/wizard-config";
import { readConnection } from "../../shared/zammad-client";
import type { AdminOverview, GetAdminOverviewResult } from "./types";

export async function getAdminOverview(): Promise<GetAdminOverviewResult> {
  const config = await readWizardConfig();
  const connection = readConnection();
  if (!connection) {
    return {
      success: true,
      data: { connection: { configured: false }, schemaFetchedAt: null, intro: config.intro, appName: config.appName, sectors: [], unsupported: [], skippedFields: [] },
    };
  }

  const [owner, schema] = await Promise.all([getTokenOwner(), loadSchema()]);
  const tokenOwner = owner.success
    ? { name: [owner.data.firstname, owner.data.lastname].filter(Boolean).join(" ") || owner.data.email, email: owner.data.email }
    : null;
  const error = !owner.success ? owner.error.message : !schema.success ? schema.error.message : null;

  const overview: AdminOverview = {
    connection: { configured: true, baseUrl: connection.baseUrl, tokenOwner, error },
    schemaFetchedAt: schema.success ? schema.data.fetchedAt : null,
    intro: config.intro,
    appName: config.appName,
    sectors: [],
    unsupported: [],
    skippedFields: [],
  };
  if (!schema.success) return { success: true, data: overview };

  // Visão de cliente sem papel nenhum: o que um colaborador comum vê.
  const built = buildSectorForms(schema.data, config, { includeDisabled: true });
  const groupNames = new Map(schema.data.groups.map((group) => [group.id, group.name]));
  overview.unsupported = built.unsupported;
  overview.skippedFields = built.skippedFields;
  overview.sectors = built.sectors.map((sector) => ({
    groupId: sector.groupId,
    zammadName: groupNames.get(sector.groupId) ?? sector.label,
    parentId: sector.parentId,
    config: groupConfigFor(config, sector.groupId),
    steps: sector.steps,
    fields: sector.steps.flatMap((step) =>
      step.fields.map((field) => ({ name: field.name, label: field.label, type: field.type, required: field.required })),
    ),
  }));
  return { success: true, data: overview };
}
