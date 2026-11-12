import type { OperationResult } from "@venore/plugin-sdk";
import type { StaffRole } from "../../shared/access-rules";

// Quem está no app e com que papel: define as abas (agente: "Atribuídos"; gestor/admin: também "Fila" e
// "Equipe") e o que cada tela oferece. No "ver como", tudo isso é da pessoa vista; `viewingAs` diz quem é.
export type AppViewer = {
  role: StaffRole;
  isStaff: boolean;
  isSupervisor: boolean;
  name: string;
  /** "Ver como" ligado: a pessoa vista (as telas são as dela, só leitura). */
  viewingAs: { name: string; email: string } | null;
};
export type GetAppViewerResult = OperationResult<AppViewer>;
