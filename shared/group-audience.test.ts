import { describe, expect, it } from "vitest";
import type { ZammadGroup, ZammadSchema, ZammadWorkflow } from "../contracts/zammad";
import { groupsAllowedByZammad } from "./form";
import { allowedGroupIds } from "./workflow";

// Recorte do desenho da FEM (fluxos 520–524): 520 tira todos os grupos de quem não é da equipe; cada
// "<Setor> - Cliente" ganha de volta o grupo do setor (as subcategorias vêm junto pela árvore).
const MANUTENCAO = 1;
const MARKETING = 2;
const RH = 3;
const RH_BENEFICIOS = 31;
const INSPETORIA = 4;

const ROLE_MANUT_CLIENTE = 101;
const ROLE_RH_CLIENTE = 103;
const ROLE_AGENTE = 200;

const groups: ZammadGroup[] = [
  { id: MANUTENCAO, name: "Manutenção", parent_id: null, active: true },
  { id: MARKETING, name: "Marketing", parent_id: null, active: true },
  { id: RH, name: "Recursos Humanos", parent_id: null, active: true },
  { id: RH_BENEFICIOS, name: "Recursos Humanos::Benefícios", parent_id: RH, active: true },
  { id: INSPETORIA, name: "Inspetoria", parent_id: null, active: true },
];

const wf = (id: number, priority: number, condition: Record<string, unknown>, perform: ZammadWorkflow["perform"]): ZammadWorkflow => ({
  id,
  name: `wf ${id}`,
  active: true,
  object: "Ticket",
  priority,
  preferences: { screen: ["create_middle"] },
  condition_selected: condition,
  condition_saved: {},
  perform,
});

const workflows: ZammadWorkflow[] = [
  wf(520, 520, { "session.role_ids": { operator: "is not", value: [String(ROLE_AGENTE)] } }, {
    "ticket.group_id": { operator: "remove_option", remove_option: groups.map((group) => String(group.id)) },
  }),
  wf(521, 521, { "session.role_ids": { operator: "is", value: [String(ROLE_MANUT_CLIENTE)] } }, {
    "ticket.group_id": { operator: "add_option", add_option: [String(MANUTENCAO)] },
  }),
  wf(524, 524, { "session.role_ids": { operator: "is", value: [String(ROLE_RH_CLIENTE)] } }, {
    "ticket.group_id": { operator: "add_option", add_option: [String(RH)] },
  }),
];

const schema: ZammadSchema = { groups, attributes: [], workflows, fetchedAt: "2026-11-17T00:00:00Z" };
const allIds = groups.map((group) => String(group.id));

describe("allowedGroupIds (Core Workflows no campo Grupo)", () => {
  it("cliente de Manutenção só vê Manutenção", () => {
    const result = allowedGroupIds(workflows, { screen: "create_middle", session: { roleIds: [ROLE_MANUT_CLIENTE] }, role: "ticket.customer" }, allIds);
    expect(result.allowed).toEqual([String(MANUTENCAO)]);
    expect(result.unsupported).toEqual([]);
  });

  it("quem tem duas funções de cliente vê os dois setores", () => {
    const result = allowedGroupIds(
      workflows,
      { screen: "create_middle", session: { roleIds: [ROLE_MANUT_CLIENTE, ROLE_RH_CLIENTE] }, role: "ticket.customer" },
      allIds,
    );
    expect(result.allowed?.sort()).toEqual([String(MANUTENCAO), String(RH)]);
  });

  it("equipe (fora do 520) não é restringida", () => {
    const result = allowedGroupIds(workflows, { screen: "create_middle", session: { roleIds: [ROLE_AGENTE] }, role: "ticket.customer" }, allIds);
    expect(result.allowed).toBeNull();
  });

  it("set_fixed_to fixa a lista e ação desconhecida é relatada", () => {
    const fixed = [wf(1, 1, {}, { "ticket.group_id": { operator: "set_fixed_to", set_fixed_to: [String(MARKETING)] } })];
    expect(allowedGroupIds(fixed, { screen: "create_middle", session: { roleIds: [] }, role: "ticket.customer" }, allIds).allowed).toEqual([String(MARKETING)]);
    const hidden = [wf(2, 1, {}, { "ticket.group_id": { operator: "hide", hide: true } })];
    expect(allowedGroupIds(hidden, { screen: "create_middle", session: { roleIds: [] }, role: "ticket.customer" }, allIds).unsupported).toHaveLength(1);
  });

  it("workflow de outra tela não vale na criação", () => {
    const edit = [{ ...wf(3, 1, {}, { "ticket.group_id": { operator: "set_fixed_to", set_fixed_to: [] } }), preferences: { screen: ["edit"] } }];
    expect(allowedGroupIds(edit, { screen: "create_middle", session: { roleIds: [] }, role: "ticket.customer" }, allIds).allowed).toBeNull();
  });
});

describe("groupsAllowedByZammad (expandido pela árvore)", () => {
  it("liberar o setor libera as subcategorias", () => {
    const visible = groupsAllowedByZammad(schema, [ROLE_RH_CLIENTE], "ticket.customer");
    expect([...(visible ?? [])].sort((a, b) => a - b)).toEqual([RH, RH_BENEFICIOS]);
  });

  it("liberar só a subcategoria mostra o pai para navegar", () => {
    const onlyChild: ZammadSchema = {
      ...schema,
      workflows: [
        workflows[0],
        wf(530, 530, { "session.role_ids": { operator: "is", value: [String(ROLE_RH_CLIENTE)] } }, {
          "ticket.group_id": { operator: "add_option", add_option: [String(RH_BENEFICIOS)] },
        }),
      ],
    };
    expect([...(groupsAllowedByZammad(onlyChild, [ROLE_RH_CLIENTE], "ticket.customer") ?? [])].sort((a, b) => a - b)).toEqual([RH, RH_BENEFICIOS]);
  });

  it("sem restrição devolve null", () => {
    expect(groupsAllowedByZammad(schema, [ROLE_AGENTE], "ticket.customer")).toBeNull();
  });

  it("sem função de cliente nenhuma: nenhum setor", () => {
    expect(groupsAllowedByZammad(schema, [], "ticket.customer")?.size).toBe(0);
  });
});
