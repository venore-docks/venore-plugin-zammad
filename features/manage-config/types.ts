import type { OperationResult } from "@venore/plugin-sdk";
import type { WizardConfig } from "../../contracts/types";

export type SaveGroupConfigInput = { groupId: number; config: unknown };
export type SaveIntroInput = { intro: string | null };
export type SaveConfigResult = OperationResult<WizardConfig>;
export type ReloadSchemaResult = OperationResult<{ fetchedAt: string }>;
