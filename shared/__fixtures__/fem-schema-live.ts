// Recorte REAL do Zammad da FEM (colabora.fem.edu.br) em 27/11/2026: grupos, atributos de ticket e Core Workflows.
// Os dados ficam em JSON (gerado por scripts/export-zammad-schema.mjs, sem dados pessoais): um literal TypeScript
// desse tamanho pesa no typecheck e no lint. Usado só nos testes.
import type { ZammadSchema } from "../../contracts/zammad";
import data from "./fem-schema-live.json";

export const FEM_SCHEMA_LIVE = data as unknown as ZammadSchema;
