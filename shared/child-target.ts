import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadExpandedTicket } from "../contracts/zammad";
import { canAllocate, canWorkTicket } from "./access-rules";
import { buildChildForm, hasActiveSubgroups, subjectRequiredMessage, type ChildForm } from "./child-form";
import { childGroupOptions, isChildMode, type ChildMode } from "./children";
import { loadTicketForViewer } from "./own-ticket";
import type { Requester } from "./requester";
import { failure } from "./results";
import { loadSchema } from "./schema";
import { readWizardConfig } from "./wizard-config";

// Destino e formulário de um chamado filho, decididos NO SERVIDOR (o navegador só diz o modo e o setor).
// Usado ao abrir o diálogo (get-child-form) e de novo ao criar (create-child-ticket): os dois lados veem os
// mesmos campos, e a criação nunca confia na lista de campos que veio do navegador.
//   subtask  setor = grupo do pai
//   sector   setor = `groupId`, que precisa ser folha e estar em childGroupOptions
export type ChildTarget = {
  parent: ZammadExpandedTicket;
  supervisor: boolean;
  groupId: number;
  form: ChildForm;
};

export async function resolveChildTarget(
  requester: Requester,
  input: { parentId: number; mode: ChildMode; groupId?: number | null },
): Promise<OperationResult<ChildTarget>> {
  if (!isChildMode(input.mode)) return failure("invalid_mode", "Escolha subtarefa ou outro setor.");

  const viewed = await loadTicketForViewer(requester, input.parentId, true);
  if (!viewed.success) return viewed;
  const { ticket: parent, mode, role } = viewed.data;
  const meId = requester.zammadUser.id;
  const supervisor = canAllocate(mode, role);
  const worker = canWorkTicket(mode, parent.owner_id, meId);
  if (!supervisor && !worker) return failure("forbidden_child", "Só quem atende este chamado ou o gestor do setor cria chamados filhos.");

  const schema = await loadSchema();
  if (!schema.success) return schema;
  const groups = schema.data.groups;

  let groupId = parent.group_id;
  if (input.mode === "sector") {
    const requested = Number(input.groupId);
    if (!input.groupId || !Number.isInteger(requested)) return failure("invalid_group", "Escolha o setor que vai receber o chamado.");
    // Setor com subgrupos exige o assunto, como na abertura: o filho nunca vai para o grupo pai.
    if (requested !== parent.group_id && hasActiveSubgroups(groups, requested)) {
      return failure("subsector_required", subjectRequiredMessage(groups, requested));
    }
    if (!childGroupOptions(groups, parent.group_id).some((group) => group.id === requested)) {
      return failure("invalid_group", "Escolha o setor que vai receber o chamado.");
    }
    groupId = requested;
  }

  const config = await readWizardConfig();
  const form = buildChildForm(schema.data, config, groupId, { roleIds: requester.zammadUser.role_ids });
  if (!form) return failure("sector_unavailable", "Este setor não recebe chamados. Escolha outro.");
  return { success: true, data: { parent, supervisor, groupId, form } };
}
