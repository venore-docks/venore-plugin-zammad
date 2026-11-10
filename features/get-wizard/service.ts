import { ATTACHMENT_LIMITS } from "../../shared/answers";
import { buildSectorForms } from "../../shared/form";
import type { Requester } from "../../shared/requester";
import { loadSchema } from "../../shared/schema";
import { readWizardConfig } from "../../shared/wizard-config";
import type { GetWizardResult } from "./types";

export async function getWizard(requester: Requester): Promise<GetWizardResult> {
  const schema = await loadSchema();
  if (!schema.success) return schema;
  const config = await readWizardConfig();
  const { sectors } = buildSectorForms(schema.data, config, { roleIds: requester.zammadUser.role_ids });
  return { success: true, data: { intro: config.intro, sectors, limits: ATTACHMENT_LIMITS } };
}
