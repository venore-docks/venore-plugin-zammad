import { ATTACHMENT_LIMITS } from "../../shared/answers";
import type { AudienceViewer } from "../../shared/audience";
import { buildSectorForms } from "../../shared/form";
import type { Requester } from "../../shared/requester";
import { loadSchema } from "../../shared/schema";
import { readWizardConfig } from "../../shared/wizard-config";
import type { GetWizardResult } from "./types";

// Só devolve os setores da audiência de quem pede (grupos de pessoas); admin do plugin vê todos (prévia).
export async function getWizard(requester: Requester, viewer: AudienceViewer): Promise<GetWizardResult> {
  const schema = await loadSchema();
  if (!schema.success) return schema;
  const config = await readWizardConfig();
  const { sectors } = buildSectorForms(schema.data, config, { roleIds: requester.zammadUser.role_ids, viewer });
  return { success: true, data: { intro: config.intro, sectors, limits: ATTACHMENT_LIMITS } };
}
