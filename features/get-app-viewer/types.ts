import type { OperationResult } from "@venore/plugin-sdk";

// Quem está no app: define as abas (agente tem "Atribuídos" e "Fila") e o que cada tela oferece.
export type AppViewer = { isAgent: boolean; name: string };
export type GetAppViewerResult = OperationResult<AppViewer>;
