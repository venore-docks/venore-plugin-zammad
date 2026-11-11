import type { OperationResult } from "@venore/plugin-sdk";
import type { StaffRole } from "../../shared/access-rules";

// Quem está no app e com que papel: define as abas (agente: "Atribuídos"; gestor/admin: também "Fila" e
// "Equipe") e o que cada tela oferece.
export type AppViewer = { role: StaffRole; isStaff: boolean; isSupervisor: boolean; name: string };
export type GetAppViewerResult = OperationResult<AppViewer>;
