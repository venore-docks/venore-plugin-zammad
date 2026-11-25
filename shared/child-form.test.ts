import { describe, expect, it } from "vitest";
import type { WizardConfig } from "../contracts/types";
import {
  DESENVOLVIMENTO,
  FEM_SCHEMA_CHILDREN,
  INFRAESTRUTURA,
  RECURSOS_HUMANOS,
  SUPORTE,
  TECNOLOGIA,
} from "./__fixtures__/fem-schema-children";
import { validateFields } from "./answers";
import { buildChildForm, childDefaults, hasActiveSubgroups, subjectRequiredMessage } from "./child-form";
import { childGroupOptions } from "./children";
import { DEFAULT_GROUP_CONFIG } from "./form";

const EMPTY: WizardConfig = { intro: null, appName: null, groups: {} };
const MANUTENCAO = 1;
const MARKETING = 6;
const MARKETING_REQUIRED = [
  "materiais_desejados",
  "orcamento_previo",
  "publico_alvo",
  "data_de_uso",
  "data_material_pronto",
  "material_referencia",
  "orientacao_especifica_comunicacao",
];
// Agente da FEM (papéis de equipe; o resultado não depende deles no recorte, só do papel ticket.agent).
const ctx = { roleIds: [2] };

const form = (groupId: number) => {
  const built = buildChildForm(FEM_SCHEMA_CHILDREN, EMPTY, groupId, ctx);
  if (!built) throw new Error(`sem formulário para o grupo ${groupId}`);
  return built;
};
const required = (groupId: number) => form(groupId).fields.filter((field) => field.required).map((field) => field.name);
const names = (groupId: number) => form(groupId).fields.map((field) => field.name);

describe("formulário do chamado filho (papel ticket.agent)", () => {
  it("Manutenção exige local_fisico", () => {
    expect(required(MANUTENCAO)).toEqual(["local_fisico"]);
  });

  it("Tecnologia e cada subgrupo exigem local_fisico", () => {
    for (const groupId of [TECNOLOGIA, SUPORTE, INFRAESTRUTURA, DESENVOLVIMENTO]) {
      expect(required(groupId), `grupo ${groupId}`).toEqual(["local_fisico"]);
    }
  });

  it("Marketing exige os 7 campos e esconde data_atendimento", () => {
    expect([...required(MARKETING)].sort()).toEqual([...MARKETING_REQUIRED].sort());
    expect(names(MARKETING)).not.toContain("data_atendimento");
    expect(names(MARKETING)).not.toContain("local_fisico");
  });

  it("Recursos Humanos não exige nenhum campo", () => {
    expect(required(RECURSOS_HUMANOS)).toEqual([]);
  });

  it("nunca pergunta os campos de triagem (NEVER_ASKED), mesmo para agente", () => {
    for (const groupId of [MANUTENCAO, MARKETING, DESENVOLVIMENTO, RECURSOS_HUMANOS]) {
      const list = names(groupId);
      for (const name of ["priority_id", "prioridade_cliente", "tempo_previsto", "state_id", "owner_id", "customer_id", "group_id", "title"]) {
        expect(list, `grupo ${groupId}`).not.toContain(name);
      }
    }
  });

  it("setor oculto no wizard continua valendo para o filho (includeDisabled)", () => {
    const hidden: WizardConfig = { ...EMPTY, groups: { [String(MANUTENCAO)]: { ...DEFAULT_GROUP_CONFIG, enabled: false } } };
    expect(buildChildForm(FEM_SCHEMA_CHILDREN, hidden, MANUTENCAO, ctx)?.fields.map((field) => field.name)).toContain("local_fisico");
  });

  it("recusa a resposta que falta: sem local_fisico, Manutenção não valida", () => {
    const errors = validateFields(form(MANUTENCAO).fields, {});
    expect(Object.keys(errors)).toEqual(["local_fisico"]);
    expect(validateFields(form(RECURSOS_HUMANOS).fields, {})).toEqual({});
  });
});

describe("valores herdados do pai", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");

  it("local_fisico do pai vem preenchido no filho", () => {
    const fields = form(MANUTENCAO).fields;
    const local = fields.find((field) => field.name === "local_fisico")!;
    const value = local.type === "select" || local.type === "multiselect" ? local.options[0].value : "Sala 12";
    const defaults = childDefaults(fields, { local_fisico: local.type === "multiselect" ? [value] : value }, now);
    expect(defaults.local_fisico).toEqual(local.type === "multiselect" ? [value] : value);
  });

  it("converte data e hora do Zammad (UTC) para o formato do wizard (UTC-3) e descarta o que não valida", () => {
    const fields = form(MARKETING).fields;
    const defaults = childDefaults(
      fields,
      {
        data_de_uso: "2026-12-10T17:30:00.000Z",
        // no passado: data_material_pronto não aceita passado → não é herdado
        data_material_pronto: "2026-01-01T12:00:00.000Z",
        materiais_desejados: ["opção que não existe"],
        orcamento_previo: true,
        title: "não é campo do formulário",
      },
      now,
    );
    expect(defaults.data_de_uso).toBe("2026-12-10T14:30");
    expect(defaults).not.toHaveProperty("data_material_pronto");
    expect(defaults).not.toHaveProperty("materiais_desejados");
    // Sim/Não nunca vem marcado
    expect(defaults).not.toHaveProperty("orcamento_previo");
    expect(defaults).not.toHaveProperty("title");
  });

  it("valor vazio no pai não sobrescreve nada", () => {
    expect(childDefaults(form(MANUTENCAO).fields, { local_fisico: "" }, now)).toEqual({});
  });
});

describe("setores para pedir", () => {
  it("só folhas: Tecnologia (com subgrupos) sai da lista, os subgrupos entram", () => {
    const ids = childGroupOptions(FEM_SCHEMA_CHILDREN.groups, DESENVOLVIMENTO).map((group) => group.id);
    expect(ids).not.toContain(TECNOLOGIA);
    expect(ids).not.toContain(DESENVOLVIMENTO);
    expect(ids).toEqual(expect.arrayContaining([SUPORTE, INFRAESTRUTURA, MANUTENCAO, MARKETING, RECURSOS_HUMANOS]));
  });

  it("grupo com subgrupos pede o assunto", () => {
    expect(hasActiveSubgroups(FEM_SCHEMA_CHILDREN.groups, TECNOLOGIA)).toBe(true);
    expect(hasActiveSubgroups(FEM_SCHEMA_CHILDREN.groups, MANUTENCAO)).toBe(false);
    expect(subjectRequiredMessage(FEM_SCHEMA_CHILDREN.groups, TECNOLOGIA)).toBe("Escolha o assunto em Tecnologia para continuar.");
  });
});
