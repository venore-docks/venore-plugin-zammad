import { describe, expect, it } from "vitest";
import type { WizardConfig } from "../contracts/types";
import { DESENVOLVIMENTO, DEV_CONDITIONAL_SCHEMA, PRIORITY_MANDATORY } from "./__fixtures__/dev-conditional-schema";
import { validateFields, type Answers } from "./answers";
import { buildChildForm, resolvedChildDefaults } from "./child-form";
import { DEFAULT_GROUP_CONFIG, buildSectorForms, resolveForm, sectorFieldCatalog } from "./form";

// Campos condicionados a OUTRA resposta (bug da v1.10.1: o formulário era montado uma vez só com o grupo, e
// ferramenta_portal / telas_afetadas nunca apareciam). Recorte sintético de Desenvolvimento.

const EMPTY: WizardConfig = { intro: null, appName: null, groups: {} };
const built = buildSectorForms(DEV_CONDITIONAL_SCHEMA, EMPTY, { roleIds: [3] });
const sector = built.sectors.find((candidate) => candidate.groupId === DESENVOLVIMENTO)!;
const resolve = (answers: Answers) => resolveForm(built.rules, DESENVOLVIMENTO, sector.presentation, answers);
const stepNames = (answers: Answers) => resolve(answers).steps.map((step) => step.fields.map((field) => field.name));

describe("resolveForm: campos condicionais por valor", () => {
  it("sem resposta, só as perguntas fixas do setor", () => {
    expect(stepNames({})).toEqual([["tipo_demanda"], ["sistema_afetado"], ["data_atendimento"]]);
  });

  it("sistema_afetado = portal: ferramenta_portal aparece na MESMA etapa, logo abaixo, e é obrigatória", () => {
    const resolved = resolve({ sistema_afetado: "portal" });
    expect(resolved.steps.map((step) => step.fields.map((field) => field.name))).toEqual([
      ["tipo_demanda"],
      ["sistema_afetado", "ferramenta_portal"],
      ["data_atendimento"],
    ]);
    expect(resolved.fields.find((field) => field.name === "ferramenta_portal")).toMatchObject({ required: true });
    // As etapas anteriores não mudam de lugar (o wizard não pula de etapa ao responder).
    expect(resolved.steps.map((step) => step.key)).toEqual(resolve({}).steps.map((step) => step.key));
  });

  it("trocar para broadcast tira a resposta da ferramenta (campo voltou a ficar oculto) e pede as telas", () => {
    const resolved = resolve({ tipo_demanda: "melhoria", sistema_afetado: "broadcast", ferramenta_portal: "chamados" });
    expect(resolved.answers).toEqual({ tipo_demanda: "melhoria", sistema_afetado: "broadcast" });
    expect(resolved.fields.map((field) => field.name)).toContain("telas_afetadas");
    expect(resolved.fields.map((field) => field.name)).not.toContain("ferramenta_portal");
  });

  it("opção não permitida e resposta de campo oculto não chegam ao Zammad", () => {
    const resolved = resolve({ sistema_afetado: "inexistente", telas_afetadas: ["recepcao"] });
    expect(resolved.answers).toEqual({});
  });

  it("o servidor recusa o envio sem a ferramenta quando o sistema é o portal (antes o Zammad devolvia 422)", () => {
    const resolved = resolve({ tipo_demanda: "correcao", sistema_afetado: "portal" });
    expect(Object.keys(validateFields(resolved.fields, resolved.answers))).toEqual(["ferramenta_portal"]);
    const ok = resolve({ tipo_demanda: "correcao", sistema_afetado: "portal", ferramenta_portal: "calendarios" });
    expect(validateFields(ok.fields, ok.answers)).toEqual({});
  });

  it("multiseleção condicional: telas_afetadas guarda só as opções válidas", () => {
    const resolved = resolve({ sistema_afetado: "broadcast", telas_afetadas: ["recepcao", "nao_existe"] });
    expect(resolved.answers.telas_afetadas).toEqual(["recepcao"]);
  });

  it("número de etapa configurado no admin vale também para o campo condicional", () => {
    const config: WizardConfig = { ...EMPTY, groups: { [String(DESENVOLVIMENTO)]: { ...DEFAULT_GROUP_CONFIG, fieldSteps: { ferramenta_portal: 1 } } } };
    const own = buildSectorForms(DEV_CONDITIONAL_SCHEMA, config, { roleIds: [3] });
    const target = own.sectors.find((candidate) => candidate.groupId === DESENVOLVIMENTO)!;
    const steps = resolveForm(own.rules, DESENVOLVIMENTO, target.presentation, { sistema_afetado: "portal" }).steps;
    expect(steps[0]).toMatchObject({ key: "step-1" });
    expect(steps[0].fields.map((field) => field.name)).toEqual(["ferramenta_portal"]);
  });
});

describe("prioridade sugerida (prioridade_cliente)", () => {
  it("opcional no Zammad: não é perguntada", () => {
    expect(resolve({}).fields.map((field) => field.name)).not.toContain("prioridade_cliente");
  });

  it("obrigatória no Zammad (por Core Workflow): é perguntada e validada", () => {
    const schema = { ...DEV_CONDITIONAL_SCHEMA, workflows: [...DEV_CONDITIONAL_SCHEMA.workflows, PRIORITY_MANDATORY] };
    const own = buildSectorForms(schema, EMPTY, { roleIds: [3] });
    const resolved = resolveForm(own.rules, DESENVOLVIMENTO, sector.presentation, {});
    expect(resolved.fields.find((field) => field.name === "prioridade_cliente")).toMatchObject({ required: true });
  });
});

describe("regras que vão ao navegador (formRules)", () => {
  it("só atributos perguntáveis e workflows que mexem neles; nada de tempo_previsto/prazo/motivo", () => {
    const names = built.rules.attributes.map((attribute) => attribute.name);
    expect(names).not.toContain("tempo_previsto");
    expect(built.rules.workflows.map((workflow) => workflow.id)).toEqual([701, 702, 703]);
    expect(built.rules.roleIds).toEqual([3]);
  });
});

describe("chamado filho com campos condicionais", () => {
  it("herda do pai o valor que libera o campo e o próprio campo condicional", () => {
    const form = buildChildForm(DEV_CONDITIONAL_SCHEMA, EMPTY, DESENVOLVIMENTO, { roleIds: [] })!;
    const resolved = resolvedChildDefaults(form, { tipo_demanda: "melhoria", sistema_afetado: "portal", ferramenta_portal: "listas", telas_afetadas: ["recepcao"] });
    expect(resolved.answers).toEqual({ tipo_demanda: "melhoria", sistema_afetado: "portal", ferramenta_portal: "listas" });
    expect(resolved.fields.map((field) => field.name)).toContain("ferramenta_portal");
  });
});

describe("sectorFieldCatalog (admin)", () => {
  it("lista os campos condicionais marcados, para o admin dar ajuda a eles", () => {
    const catalog = sectorFieldCatalog(built.rules, DESENVOLVIMENTO, sector.presentation);
    expect(catalog.map(({ field, conditional }) => [field.name, conditional])).toEqual([
      ["tipo_demanda", false],
      ["sistema_afetado", false],
      ["ferramenta_portal", true],
      ["telas_afetadas", true],
      ["data_atendimento", false],
    ]);
  });
});
