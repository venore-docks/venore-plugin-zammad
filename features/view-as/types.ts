import type { OperationResult } from "@venore/plugin-sdk";

// "Ver como" (só leitura): admin do Colabora vê as telas como outra pessoa. Ver shared/view-as.ts.
export type ViewAsPerson = { id: string; name: string | null; email: string; hasAccess: boolean };
export type ViewAsStatus = { canViewAs: boolean; target: ViewAsPerson | null };

export type GetViewAsStatusResult = OperationResult<ViewAsStatus>;
export type SearchViewAsTargetsResult = OperationResult<ViewAsPerson[]>;
export type StartViewAsResult = OperationResult<ViewAsPerson>;
export type StopViewAsResult = OperationResult<null>;
