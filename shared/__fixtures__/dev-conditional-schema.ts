// Recorte SINTÉTICO de Tecnologia::Desenvolvimento (grupo 21), no mesmo formato das regras reais (53, 54–56 em
// fem-schema-live.ts), para testar operadores e casos-limite do avaliador sem depender do recorte real. Montado a partir da configuração descrita em
// 27/11/2026 (o recorte real de 10/11 é anterior a esses campos). Reproduz o bug da v1.10.1: ferramenta_portal só
// aparece (e é obrigatória) com sistema_afetado = portal; telas_afetadas, com sistema_afetado = broadcast.
// A conferência com o Zammad real fica em form-live.test.ts.
import type { ZammadAttribute, ZammadSchema, ZammadWorkflow } from "../../contracts/zammad";

const hiddenForAll = { create_middle: { "-all-": { shown: false, required: false } } };

function select(name: string, display: string, position: number, options: Record<string, string>, multiple = false): ZammadAttribute {
  return {
    name,
    object: "Ticket",
    display,
    data_type: multiple ? "multiselect" : "select",
    active: true,
    editable: true,
    position,
    data_option: { options, default: "", null: true, ...(multiple ? { multiple: true } : {}) },
    screens: hiddenForAll,
  };
}

export const DESENVOLVIMENTO = 21;

const attributes: ZammadAttribute[] = [
  select("tipo_demanda", "Tipo de demanda", 1100, { correcao: "Correção de erro", melhoria: "Melhoria", nova: "Nova funcionalidade" }),
  select("sistema_afetado", "Sistema afetado", 1110, {
    portal: "Portal do Colaborador",
    nest_pro: "Nest Pro",
    prime: "Prime",
    broadcast: "Broadcast e TVs",
    outro: "Outro",
  }),
  select("ferramenta_portal", "Ferramenta do portal", 1120, { chamados: "Chamados", calendarios: "Calendários", listas: "Listas de materiais" }),
  select("telas_afetadas", "Telas afetadas", 1130, { recepcao: "Recepção", refeitorio: "Refeitório", auditorio: "Auditório" }, true),
  {
    name: "data_atendimento",
    object: "Ticket",
    display: "Data sugerida para atendimento",
    data_type: "datetime",
    active: true,
    editable: true,
    position: 1200,
    data_option: { future: true, past: false, null: true },
    screens: hiddenForAll,
  },
  // Prioridade sugerida: visível para quem abre; obrigatória só por regra (teste de ASKED_ONLY_IF_REQUIRED).
  {
    ...select("prioridade_cliente", "Prioridade sugerida", 902, { "1": "Baixa", "2": "Normal", "3": "Alta", "4": "Urgente" }),
    screens: { create_middle: { "-all-": { shown: true, required: false } } },
  },
];

const inGroup = { "ticket.group_id": { operator: "is", value: [String(DESENVOLVIMENTO)] } };

function workflow(id: number, priority: number, condition: Record<string, unknown>, perform: ZammadWorkflow["perform"]): ZammadWorkflow {
  return {
    id,
    name: `Desenvolvimento #${id}`,
    active: true,
    object: "Ticket",
    priority,
    stop_after_match: false,
    preferences: { screen: ["create_middle"] },
    condition_selected: condition,
    condition_saved: {},
    perform,
  };
}

const workflows: ZammadWorkflow[] = [
  workflow(701, 700, inGroup, {
    "ticket.tipo_demanda": { operator: ["show", "set_mandatory"], show: "true", set_mandatory: "true" },
    "ticket.sistema_afetado": { operator: ["show", "set_mandatory"], show: "true", set_mandatory: "true" },
    "ticket.data_atendimento": { operator: "show", show: "true" },
  }),
  workflow(702, 710, { ...inGroup, "ticket.sistema_afetado": { operator: "is", value: ["portal"] } }, {
    "ticket.ferramenta_portal": { operator: ["show", "set_mandatory"], show: "true", set_mandatory: "true" },
  }),
  workflow(703, 720, { ...inGroup, "ticket.sistema_afetado": { operator: "is", value: ["broadcast"] } }, {
    "ticket.telas_afetadas": { operator: ["show", "set_mandatory"], show: "true", set_mandatory: "true" },
  }),
];

export const DEV_CONDITIONAL_SCHEMA: ZammadSchema = {
  groups: [
    { id: 2, name: "Tecnologia", name_last: "Tecnologia", parent_id: null, active: true },
    { id: DESENVOLVIMENTO, name: "Tecnologia::Desenvolvimento", name_last: "Desenvolvimento", parent_id: 2, active: true },
  ],
  attributes,
  workflows,
  fetchedAt: "2026-11-27T00:00:00.000Z",
};

// Regra extra para o teste: prioridade sugerida obrigatória para todos na abertura.
export const PRIORITY_MANDATORY: ZammadWorkflow = workflow(704, 730, {}, {
  "ticket.prioridade_cliente": { operator: "set_mandatory", set_mandatory: "true" },
});
