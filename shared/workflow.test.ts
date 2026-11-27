import { describe, expect, it } from "vitest";
import type { ZammadWorkflow } from "../contracts/zammad";
import { DESENVOLVIMENTO, DEV_CONDITIONAL_SCHEMA } from "./__fixtures__/dev-conditional-schema";
import { FEM_SCHEMA } from "./__fixtures__/fem-schema";
import { evaluateWorkflows, fieldDependencies, flattenOptions, type EvaluationContext } from "./workflow";

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
      condition_selected: { "ticket.title": { operator: "has changed", value: "x" } },
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

describe("evaluateWorkflows: condições sobre valores e ações (v1.11.0)", () => {
  const dev = DEV_CONDITIONAL_SCHEMA;
  const evaluate = (ticket: Record<string, unknown>, workflows: ZammadWorkflow[] = dev.workflows, extra: Partial<EvaluationContext> = {}) =>
    evaluateWorkflows(dev.attributes, workflows, {
      screen: "create_middle",
      ticket: { group_id: String(DESENVOLVIMENTO), ...ticket },
      session: { roleIds: [3] },
      role: "ticket.customer",
      ...extra,
    });
  const rule = (id: number, priority: number, condition: Record<string, unknown>, perform: ZammadWorkflow["perform"]): ZammadWorkflow => ({
    id,
    name: `teste ${id}`,
    active: true,
    object: "Ticket",
    priority,
    preferences: { screen: ["create_middle"] },
    condition_selected: condition,
    condition_saved: {},
    perform,
  });

  it("campo condicional por valor: ferramenta_portal só com sistema_afetado = portal (bug da v1.10.1)", () => {
    expect(evaluate({}).fields.ferramenta_portal).toMatchObject({ visible: false, mandatory: false });
    expect(evaluate({ sistema_afetado: "portal" }).fields.ferramenta_portal).toMatchObject({ visible: true, mandatory: true });
    expect(evaluate({ sistema_afetado: "portal" }).fields.telas_afetadas.visible).toBe(false);
    expect(evaluate({ sistema_afetado: "broadcast" }).fields.telas_afetadas).toMatchObject({ visible: true, mandatory: true });
    expect(evaluate({ sistema_afetado: "broadcast" }).fields.ferramenta_portal.visible).toBe(false);
  });

  it("prioridade entre regras: o número maior roda depois e vence, qualquer que seja a ordem da lista", () => {
    const show = rule(801, 900, {}, { "ticket.ferramenta_portal": { operator: "show", show: "true" } });
    const hide = rule(802, 950, {}, { "ticket.ferramenta_portal": { operator: "hide", hide: "true" } });
    expect(evaluate({}, [show, hide]).fields.ferramenta_portal.visible).toBe(false);
    expect(evaluate({}, [hide, show]).fields.ferramenta_portal.visible).toBe(false);
    const later = rule(803, 990, {}, { "ticket.ferramenta_portal": { operator: "show", show: "true" } });
    expect(evaluate({}, [later, show, hide]).fields.ferramenta_portal.visible).toBe(true);
  });

  it("set_fixed_to, remove_option e add_option na ordem de prioridade", () => {
    const fixed = rule(811, 800, {}, { "ticket.sistema_afetado": { operator: "set_fixed_to", set_fixed_to: ["portal", "prime"] } });
    const removed = rule(812, 810, {}, { "ticket.sistema_afetado": { operator: "remove_option", remove_option: ["prime"] } });
    const added = rule(813, 820, {}, { "ticket.sistema_afetado": { operator: "add_option", add_option: ["broadcast", "nao_existe"] } });
    expect(evaluate({}, [...dev.workflows, fixed]).fields.sistema_afetado.allowed).toEqual(["portal", "prime"]);
    expect(evaluate({}, [...dev.workflows, fixed, removed]).fields.sistema_afetado.allowed).toEqual(["portal"]);
    // add_option só devolve opções que existem no atributo.
    expect(evaluate({}, [...dev.workflows, added, removed, fixed]).fields.sistema_afetado.allowed).toEqual(["portal", "broadcast"]);
    // remove_option sem restrição anterior parte de todas as opções.
    expect(evaluate({}, [...dev.workflows, removed]).fields.sistema_afetado.allowed).toEqual(["portal", "nest_pro", "broadcast", "outro"]);
  });

  it("set_readonly e unset_readonly", () => {
    const lock = rule(821, 800, {}, { "ticket.tipo_demanda": { operator: "set_readonly", set_readonly: "true" } });
    const unlock = rule(822, 810, { "ticket.sistema_afetado": { operator: "is", value: ["outro"] } }, {
      "ticket.tipo_demanda": { operator: "unset_readonly", unset_readonly: "true" },
    });
    expect(evaluate({}, [...dev.workflows, lock, unlock]).fields.tipo_demanda.readonly).toBe(true);
    expect(evaluate({ sistema_afetado: "outro" }, [...dev.workflows, lock, unlock]).fields.tipo_demanda.readonly).toBe(false);
  });

  it("condição pela função (session.role_ids) e pelo ticket salvo (condition_saved)", () => {
    const byRole = rule(831, 800, { "session.role_ids": { operator: "is", value: ["9"] } }, { "ticket.ferramenta_portal": { operator: "show", show: "true" } });
    expect(evaluate({}, [byRole]).fields.ferramenta_portal.visible).toBe(false);
    expect(evaluate({}, [byRole], { session: { roleIds: [3, 9] } }).fields.ferramenta_portal.visible).toBe(true);
    const bySaved: ZammadWorkflow = {
      ...rule(832, 800, {}, { "ticket.ferramenta_portal": { operator: "show", show: "true" } }),
      condition_saved: { "ticket.state_id": { operator: "is", value: ["8"] } },
    };
    expect(evaluate({}, [bySaved]).fields.ferramenta_portal.visible).toBe(false);
    expect(evaluate({}, [bySaved], { saved: { state_id: 8 } }).fields.ferramenta_portal.visible).toBe(true);
  });

  it("pre_condition current_user.id (ex.: regra 612 da FEM: cliente não é quem edita)", () => {
    const notMe = rule(851, 800, { "ticket.customer_id": { operator: "is not", pre_condition: "current_user.id", value: [] } }, {
      "ticket.ferramenta_portal": { operator: "show", show: "true" },
    });
    expect(evaluate({ customer_id: 5 }, [notMe], { session: { roleIds: [], userId: 7 } }).fields.ferramenta_portal.visible).toBe(true);
    expect(evaluate({ customer_id: 7 }, [notMe], { session: { roleIds: [], userId: 7 } }).fields.ferramenta_portal.visible).toBe(false);
    // Sem usuário no contexto, a regra não casa e é reportada.
    const result = evaluate({ customer_id: 7 }, [notMe]);
    expect(result.fields.ferramenta_portal.visible).toBe(false);
    expect(result.unsupported.some((message) => message.includes("#851"))).toBe(true);
  });

  it("operadores equivalentes e de texto: is_not, is any of, contains, starts with, regex", () => {
    const cases: [string, unknown, string, boolean][] = [
      ["is_not", ["portal"], "prime", true],
      ["is not", ["portal"], "portal", false],
      ["is any of", ["portal", "prime"], "prime", true],
      ["is none of", ["portal", "prime"], "prime", false],
      ["contains", "ort", "portal", true],
      ["contains not", "ort", "portal", false],
      ["starts with", "nest", "nest_pro", true],
      ["ends with", "cast", "broadcast", true],
      ["regex match", "^p(ortal|rime)$", "prime", true],
      ["regex mismatch", "^p", "prime", false],
      ["not set", null, "", true],
    ];
    for (const [operator, value, answer, expected] of cases) {
      const conditional = rule(841, 800, { "ticket.sistema_afetado": { operator, value } }, { "ticket.ferramenta_portal": { operator: "show", show: "true" } });
      const result = evaluate(answer ? { sistema_afetado: answer } : {}, [conditional]);
      expect(result.fields.ferramenta_portal.visible, `${operator} ${String(value)} × ${answer}`).toBe(expected);
      expect(result.unsupported).toEqual([]);
    }
  });

  it("modo potencial (admin): condição sobre valor conta como verdadeira, a de grupo não", () => {
    const potential = evaluate({}, dev.workflows, { assumeFieldConditions: true });
    expect(potential.fields.ferramenta_portal.visible).toBe(true);
    expect(potential.fields.telas_afetadas.visible).toBe(true);
    const otherGroup = evaluateWorkflows(dev.attributes, dev.workflows, {
      screen: "create_middle",
      ticket: { group_id: "2" },
      session: { roleIds: [] },
      role: "ticket.customer",
      assumeFieldConditions: true,
    });
    expect(otherGroup.fields.ferramenta_portal.visible).toBe(false);
  });

  it("fieldDependencies: quem libera cada campo (grupo e estado não contam)", () => {
    const dependencies = fieldDependencies(dev.workflows, "create_middle");
    expect([...(dependencies.get("ferramenta_portal") ?? [])]).toEqual(["sistema_afetado"]);
    expect([...(dependencies.get("telas_afetadas") ?? [])]).toEqual(["sistema_afetado"]);
    expect(dependencies.has("tipo_demanda")).toBe(false);
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
