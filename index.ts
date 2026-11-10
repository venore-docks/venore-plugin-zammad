export { zammadBreadcrumbSegments } from "./breadcrumbs";

export { getWizardHandler as getWizard } from "./features/get-wizard/handler";
export { createTicketHandler as createTicket } from "./features/create-ticket/handler";
export { listMyTicketsHandler as listMyTickets } from "./features/list-my-tickets/handler";
export { getAdminOverviewHandler as getAdminOverview } from "./features/admin-overview/handler";
export {
  saveGroupConfigHandler as saveGroupConfig,
  saveIntroHandler as saveIntro,
  reloadSchemaHandler as reloadSchema,
} from "./features/manage-config/handler";

export type {
  AnswerValue,
  AttachmentLimits,
  CreatedTicket,
  FieldOption,
  FieldType,
  GroupWizardConfig,
  SectorForm,
  TicketStateTone,
  TicketSummary,
  WizardConfig,
  WizardData,
  WizardField,
  WizardStep,
} from "./contracts/types";
export type { GetWizardResult } from "./features/get-wizard/types";
export type { CreateTicketInput, CreateTicketResult, TicketAttachment } from "./features/create-ticket/types";
export type { ListMyTicketsResult } from "./features/list-my-tickets/types";
export type { AdminField, AdminOverview, AdminSector, ConnectionStatus, GetAdminOverviewResult } from "./features/admin-overview/types";
export type { ReloadSchemaResult, SaveConfigResult, SaveGroupConfigInput, SaveIntroInput } from "./features/manage-config/types";
