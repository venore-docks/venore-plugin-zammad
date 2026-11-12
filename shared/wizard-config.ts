import "server-only";
import { z } from "zod";
import type { OperationResult } from "@venore/plugin-sdk";
import { getSetting, setSetting } from "@venore/plugin-sdk/settings";
import type { GroupWizardConfig, WizardConfig } from "../contracts/types";
import { LEGACY_WIZARD_SETTING_KEY, WIZARD_SETTING_KEY } from "./permissions";
import { failure } from "./results";

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null));

export const groupConfigSchema = z.object({
  enabled: z.boolean(),
  label: nullableText(80),
  description: nullableText(300),
  bodyHint: nullableText(1000),
  order: z.number().int().min(0).max(999).nullable(),
  fieldHelp: z.record(z.string(), z.string().max(500)),
  fieldSteps: z.record(z.string(), z.number().int().min(1).max(50)),
  stepTitles: z.record(z.string(), z.string().max(120)),
});

const wizardConfigSchema = z.object({
  intro: nullableText(1000),
  // Opcional no documento salvo: configs anteriores à v0.5 não têm o campo.
  appName: nullableText(30).optional().transform((value) => value ?? null),
  groups: z.record(z.string(), groupConfigSchema),
});

export const EMPTY_CONFIG: WizardConfig = { intro: null, appName: null, groups: {} };

export async function readWizardConfig(): Promise<WizardConfig> {
  let result = await getSetting({ key: WIZARD_SETTING_KEY });
  // Reserva da troca de chave (zammad → colabora): enquanto o admin não salvar de novo, vale a configuração
  // que já estava gravada no setting antigo (só leitura; o próximo "Salvar" grava no novo).
  if (result.success && !result.data) result = await getSetting({ key: LEGACY_WIZARD_SETTING_KEY });
  if (!result.success || !result.data) return EMPTY_CONFIG;
  const parsed = wizardConfigSchema.safeParse(result.data.value);
  // Setting corrompido não derruba a abertura de chamados: cai no padrão (tudo automático).
  return parsed.success ? parsed.data : EMPTY_CONFIG;
}

export function parseGroupConfig(input: unknown): OperationResult<GroupWizardConfig> {
  const parsed = groupConfigSchema.safeParse(input);
  if (!parsed.success) return failure("invalid_config", "Configuração inválida: confira os campos e tente de novo.");
  // Limpa ajudas/títulos vazios para o documento não acumular chaves mortas.
  const data = parsed.data;
  return {
    success: true,
    data: {
      ...data,
      fieldHelp: Object.fromEntries(Object.entries(data.fieldHelp).filter(([, text]) => text.trim().length > 0)),
      stepTitles: Object.fromEntries(Object.entries(data.stepTitles).filter(([, text]) => text.trim().length > 0)),
    },
  };
}

export async function writeWizardConfig(config: WizardConfig): Promise<OperationResult<WizardConfig>> {
  const parsed = wizardConfigSchema.safeParse(config);
  if (!parsed.success) return failure("invalid_config", "Configuração inválida.");
  const saved = await setSetting({ key: WIZARD_SETTING_KEY, value: parsed.data });
  if (!saved.success) return saved;
  return { success: true, data: parsed.data };
}
