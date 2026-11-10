// Formato cru da API REST do Zammad (7.x) — só os campos que o plugin usa.

export type ZammadGroup = {
  id: number;
  name: string;
  name_last?: string | null;
  parent_id: number | null;
  active: boolean;
  note?: string | null;
};

// `screens.create_middle["ticket.customer" | "ticket.agent" | "-all-"]`
export type ZammadScreenConfig = { shown?: boolean; required?: boolean; null?: boolean };

export type ZammadAttribute = {
  name: string;
  object: string;
  display: string;
  data_type: string;
  active: boolean;
  editable: boolean;
  position: number;
  data_option: Record<string, unknown>;
  screens: Record<string, Record<string, ZammadScreenConfig>>;
};

// Condição simples ({ "ticket.group_id": { operator: "is", value: ["6"] } }) — o modo "expert"
// ({ operator: "AND", conditions: [...] }) também é aceito pelo avaliador.
export type ZammadCondition = { operator: string; value?: unknown; name?: string; conditions?: ZammadCondition[] };

export type ZammadWorkflow = {
  id: number;
  name: string;
  active: boolean;
  object: string;
  priority: number;
  stop_after_match?: boolean;
  preferences?: { screen?: string[] | string } | null;
  condition_selected?: Record<string, unknown> | null;
  condition_saved?: Record<string, unknown> | null;
  perform: Record<string, { operator: string | string[]; [key: string]: unknown }>;
};

export type ZammadSchema = {
  groups: ZammadGroup[];
  attributes: ZammadAttribute[];
  workflows: ZammadWorkflow[];
  fetchedAt: string;
};

export type ZammadUser = {
  id: number;
  email: string;
  firstname?: string | null;
  lastname?: string | null;
  role_ids: number[];
  active: boolean;
};

// /tickets/search?expand=true — `group`/`state`/`priority` já vêm como nome.
export type ZammadExpandedTicket = {
  id: number;
  number: string;
  title: string;
  group: string;
  state: string;
  created_at: string;
  updated_at: string;
};
