// Recorte da FEM com os grupos que o chamado filho precisa (v1.8.0), DERIVADO de FEM_SCHEMA (2026-11-10).
//
// ATENÇÃO: NÃO é um snapshot do Zammad. O recorte real é anterior aos subgrupos de Tecnologia e ao grupo
// "Recursos Humanos"; aqui eles foram modelados como descritos em docs/zammad-fem.md §1.3 (ids 21–23 e 30
// inventados) e o workflow "Tecnologia Ticket - Mostrar campos exclusivos" passa a valer também para os
// subgrupos (como os fluxos "Formulário - Tecnologia" do Zammad atual). Ao exportar o schema real, substitua
// este arquivo por ele e ajuste os ids em child-form.test.ts.
import type { ZammadSchema } from "../../contracts/zammad";
import { FEM_SCHEMA } from "./fem-schema";

export const TECNOLOGIA = 2;
export const SUPORTE = 21;
export const INFRAESTRUTURA = 22;
export const DESENVOLVIMENTO = 23;
export const RECURSOS_HUMANOS = 30;

const TECH_GROUP_IDS = [TECNOLOGIA, SUPORTE, INFRAESTRUTURA, DESENVOLVIMENTO].map(String);

export const FEM_SCHEMA_CHILDREN: ZammadSchema = {
  ...FEM_SCHEMA,
  groups: [
    ...FEM_SCHEMA.groups,
    { id: SUPORTE, name: "Tecnologia::Suporte", name_last: "Suporte", parent_id: TECNOLOGIA, active: true, note: null },
    { id: INFRAESTRUTURA, name: "Tecnologia::Infraestrutura", name_last: "Infraestrutura", parent_id: TECNOLOGIA, active: true, note: null },
    { id: DESENVOLVIMENTO, name: "Tecnologia::Desenvolvimento", name_last: "Desenvolvimento", parent_id: TECNOLOGIA, active: true, note: null },
    { id: RECURSOS_HUMANOS, name: "Recursos Humanos", name_last: "Recursos Humanos", parent_id: null, active: true, note: null },
  ],
  workflows: FEM_SCHEMA.workflows.map((workflow) =>
    workflow.name === "Tecnologia Ticket - Mostrar campos exclusivos"
      ? { ...workflow, condition_selected: { "ticket.group_id": { operator: "is", value: TECH_GROUP_IDS, value_completion: "" } } }
      : workflow,
  ),
};
