import { describe, expect, it } from "vitest";
import type { ZammadWorkflow } from "../contracts/zammad";
import { FEM_SCHEMA } from "./__fixtures__/fem-schema";
import { evaluateWorkflows, flattenOptions } from "./workflow";

const visibleFor = (groupId: number, workflows: ZammadWorkflow[] = FEM_SCHEMA.workflows) => {
  const { fields, unsupported } = evaluateWorkflows(FEM_SCHEMA.attributes, workflows, {
    screen: "create_middle",
    ticket: { group_id: String(groupId) },
    session: { roleIds: [3] },
    role: "ticket.customer",
  });
  const visible = Object.entries(fields)
    .filter(([, state]) => state.visible)
    .map(([name]) => name)
    .sort();
  const mandatory = Object.entries(fields)
    .filter(([, state]) => state.mandatory)
    .map(([name]) => name)
    .sort();
  return { visible, mandatory, unsupported };
};

describe("evaluateWorkflows (Core Workflows reais da FEM)", () => {
  it("Marketing (#6): os 7 campos de pedido de material, todos obrigatórios; sem data de atendimento", () => {
    const { visible, mandatory, unsupported } = visibleFor(6);
    expect(visible).toEqual(
      [
        "data_de_uso",
        "data_material_pronto",
        "materiais_desejados",
        "material_referencia",
        "orcamento_previo",
        "orientacao_especifica_comunicacao",
        "prioridade_cliente",
        "publico_alvo",
      ].sort(),
    );
    expect(mandatory).toEqual(
      [
        "data_de_uso",
        "data_material_pronto",
        "materiais_desejados",
        "material_referencia",
        "orcamento_previo",
        "orientacao_especifica_comunicacao",
        "publico_alvo",
      ].sort(),
    );
    expect(unsupported).toEqual([]);
  });

  it("Manutenção (#1) e Tecnologia (#2): local obrigatório + data sugerida opcional", () => {
    for (const group of [1, 2]) {
      const { visible, mandatory } = visibleFor(group);
      expect(visible).toEqual(["data_atendimento", "local_fisico", "prioridade_cliente"]);
      expect(mandatory).toEqual(["local_fisico"]);
    }
  });

  it("Registro de Ocorrências (#13): só a data da ocorrência (obrigatória pela tela), sem prioridade", () => {
    const { visible, mandatory } = visibleFor(13);
    expect(visible).toEqual(["data_ocorrencia"]);
    expect(mandatory).toEqual(["data_ocorrencia"]);
  });

  it("grupo sem regra própria (Zeladoria #5): prioridade e data sugerida, nada obrigatório", () => {
    const { visible, mandatory } = visibleFor(5);
    expect(visible).toEqual(["data_atendimento", "prioridade_cliente"]);
    expect(mandatory).toEqual([]);
  });

  it("ignora workflow inativo e respeita a prioridade (o de número maior vence)", () => {
    const withoutMarketing = FEM_SCHEMA.workflows.map((workflow) => (workflow.id === 12 ? { ...workflow, active: false } : workflow));
    expect(visibleFor(6, withoutMarketing).visible).toEqual(["data_atendimento", "prioridade_cliente"]);
  });

  it("condição desconhecida não aplica a regra e é reportada", () => {
    const odd: ZammadWorkflow = {
      ...FEM_SCHEMA.workflows[1],
      id: 99,
      condition_selected: { "ticket.title": { operator: "regex match", value: "x" } },
    };
    const { unsupported } = visibleFor(6, [...FEM_SCHEMA.workflows, odd]);
    expect(unsupported.some((message) => message.includes("#99"))).toBe(true);
  });

  it("modo expert (AND/OR) e set_fixed_to", () => {
    const expert: ZammadWorkflow = {
      id: 100,
      name: "expert",
      active: true,
      object: "Ticket",
      priority: 900,
      preferences: { screen: [] },
      condition_selected: {
        operator: "OR",
        conditions: [
          { name: "ticket.group_id", operator: "is", value: ["1"] },
          { name: "ticket.group_id", operator: "is", value: ["2"] },
        ],
      },
      perform: { "ticket.local_fisico": { operator: "set_fixed_to", set_fixed_to: ["101", "102"] } },
    };
    const { fields } = evaluateWorkflows(FEM_SCHEMA.attributes, [...FEM_SCHEMA.workflows, expert], {
      screen: "create_middle",
      ticket: { group_id: "2" },
      session: { roleIds: [] },
      role: "ticket.customer",
    });
    expect(fields.local_fisico.allowed).toEqual(["101", "102"]);
  });
});

describe("flattenOptions", () => {
  it("objeto chave → rótulo e árvore com filhos", () => {
    expect(flattenOptions({ a: "A", b: "B" })).toEqual([
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ]);
    expect(flattenOptions([{ name: "Bloco 1", value: "b1", children: [{ name: "Térreo", value: "b1::t" }] }])).toEqual([
      { value: "b1", label: "Bloco 1" },
      { value: "b1::t", label: "Bloco 1 › Térreo" },
    ]);
  });
});
