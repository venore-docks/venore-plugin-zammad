import type { OperationResult } from "@venore/plugin-sdk";
import type { FieldType, GroupWizardConfig, WizardStep } from "../../contracts/types";

export type AdminField = { name: string; label: string; type: FieldType; required: boolean };

export type AdminSector = {
  groupId: number;
  zammadName: string;
  parentId: number | null;
  config: GroupWizardConfig;
  fields: AdminField[];
  steps: WizardStep[];
};

export type ConnectionStatus =
  | { configured: false }
  | {
      configured: true;
      baseUrl: string;
      tokenOwner: { name: string; email: string } | null;
      error: string | null;
    };

export type AdminOverview = {
  connection: ConnectionStatus;
  schemaFetchedAt: string | null;
  intro: string | null;
  sectors: AdminSector[];
  unsupported: string[];
  skippedFields: string[];
};

export type GetAdminOverviewResult = OperationResult<AdminOverview>;
