import type { Answers } from "../../shared/answers";
import { resolvedChildDefaults } from "../../shared/child-form";
import { resolveChildTarget } from "../../shared/child-target";
import type { Requester } from "../../shared/requester";
import type { AnswerValue } from "../../contracts/types";
import type { GetChildFormInput, GetChildFormResult } from "./types";

// Mesma checagem de permissão e mesmo destino da criação (resolveChildTarget): quem não pode criar o filho
// também não vê o formulário. As regras vão junto para o diálogo reavaliar a cada resposta.
export async function getChildForm(requester: Requester, input: GetChildFormInput): Promise<GetChildFormResult> {
  const target = await resolveChildTarget(requester, input);
  if (!target.success) return target;
  const { form, parent, groupId } = target.data;
  const resolved = resolvedChildDefaults(form, parent as unknown as Record<string, unknown>);
  return {
    success: true,
    data: { groupId, fields: resolved.fields, defaults: compact(resolved.answers), rules: form.rules, presentation: form.presentation },
  };
}

// `undefined` não atravessa a server action de forma previsível: só vão valores (ou null).
function compact(answers: Answers): Record<string, AnswerValue | null> {
  const out: Record<string, AnswerValue | null> = {};
  for (const [name, value] of Object.entries(answers)) out[name] = value ?? null;
  return out;
}
