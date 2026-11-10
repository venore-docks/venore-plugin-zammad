// Tipos que a interface usa. Nada aqui depende de servidor: o wizard (cliente) importa daqui.

export type FieldType = "select" | "multiselect" | "boolean" | "date" | "datetime" | "text" | "textarea" | "integer";
export type FieldOption = { value: string; label: string };
export type AnswerValue = string | string[] | boolean | number;

export type WizardField = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: FieldOption[];
  help: string | null;
  maxLength: number | null;
  // date/datetime: o Zammad recusa passado (future) ou futuro (past) quando só um deles é permitido.
  allowFuture: boolean;
  allowPast: boolean;
  defaultValue: AnswerValue | null;
};

export type WizardStep = { key: string; title: string; fields: WizardField[] };

export type SectorForm = {
  groupId: number;
  parentId: number | null;
  label: string;
  description: string | null;
  bodyHint: string | null;
  order: number | null;
  steps: WizardStep[];
};

export type WizardData = {
  intro: string | null;
  sectors: SectorForm[];
  limits: AttachmentLimits;
};

export type AttachmentLimits = { maxFiles: number; maxTotalBytes: number };

export type TicketStateTone = "new" | "open" | "pending" | "closed";

export type TicketSummary = {
  id: number;
  number: string;
  title: string;
  group: string;
  state: string;
  stateLabel: string;
  stateTone: TicketStateTone;
  createdAt: string;
  updatedAt: string;
  url: string;
};

export type CreatedTicket = { id: number; number: string; url: string };

// Configuração de apresentação guardada no setting `zammad.wizard` (o Zammad continua dono dos campos).
export type GroupWizardConfig = {
  enabled: boolean;
  label: string | null;
  description: string | null;
  bodyHint: string | null;
  order: number | null;
  fieldHelp: Record<string, string>;
  fieldSteps: Record<string, number>;
  stepTitles: Record<string, string>;
};

export type WizardConfig = {
  intro: string | null;
  groups: Record<string, GroupWizardConfig>;
};
