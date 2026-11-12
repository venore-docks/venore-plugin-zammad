import type { OperationResult } from "@venore/plugin-sdk";
import type { FieldType, GroupWizardConfig } from "../../contracts/types";
import type { AudienceBadge } from "../../shared/audience";
import type { PeopleGroupSummary } from "../manage-people-groups/types";

export type AdminField = { name: string; label: string; type: FieldType; required: boolean };

export type AdminSector = {
  groupId: number;
  zammadName: string;
  parentId: number | null;
  config: GroupWizardConfig;
  fields: AdminField[];
  // Etapas de perguntas do setor (sem contar Setor/Pedido/Revisão).
  stepCount: number;
  // Quem enxerga o setor, já com a herança resolvida (selo "Todos" / "Só: TI, RH" / "Oculto").
  audience: AudienceBadge;
};

export type ConnectionStatus =
  | { configured: false }
  | {
      configured: true;
      baseUrl: string;
      tokenOwner: { name: string; email: string } | null;
      error: string | null;
    };

// Quanto carregar. "config" não chama o Zammad (grupos de pessoas, nome do app, texto de abertura);
// "sectors" lê o schema (com cache de 5 min); "full" também lê o dono do token e a equipe (visão geral).
export type AdminOverviewLevel = "config" | "sectors" | "full";
export type AdminOverviewInput = { level?: AdminOverviewLevel };

export type StaffCounts = { agents: number; managers: number; admins: number };

export type AdminOverview = {
  connection: ConnectionStatus;
  schemaFetchedAt: string | null;
  intro: string | null;
  appName: string | null;
  sectors: AdminSector[];
  peopleGroups: PeopleGroupSummary[];
  // null = não carregado (nível menor que "full") ou o diretório do Zammad não respondeu.
  staff: StaffCounts | null;
  unsupported: string[];
  skippedFields: string[];
};

export type GetAdminOverviewResult = OperationResult<AdminOverview>;
