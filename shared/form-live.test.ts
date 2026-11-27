import { describe, expect, it } from "vitest";
import type { WizardConfig } from "../contracts/types";
import { FEM_SCHEMA_LIVE } from "./__fixtures__/fem-schema-live";
import { validateFields, type Answers } from "./answers";
import { buildChildForm } from "./child-form";
import { buildSectorForms, resolveForm } from "./form";
import { evaluateWorkflows } from "./workflow";

// Recorte REAL do Zammad da FEM em 27/11/2026 (scripts/export-zammad-schema.mjs). Confere o formulário de
// Tecnologia com a configuração dos setores e o bug da v1.10.1 (ferramenta_portal / telas_afetadas).

const EMPTY: WizardConfig = { intro: null, appName: null, groups: {} };
const SUPORTE = 19;
const INFRA = 20;
const DEV = 21;
const ACESSO = 22;

const built = buildSectorForms(FEM_SCHEMA_LIVE, EMPTY);
const presentationOf = (groupId: number) => built.sectors.find((sector) => sector.groupId === groupId)!.presentation;
const resolve = (groupId: number, answers: Answers = {}) => resolveForm(built.rules, groupId, presentationOf(groupId), answers);
// acesso_nome / acesso_email (v. docs/plano-colabora-v2.md): atributos novos do Zammad que, em 27/11/2026, ainda
// apareciam em TODOS os setores (as regras "ocultar por padrão" e "mostrar em Acesso a sistemas" não foram criadas).
// Ficam fora deste resumo para o teste não fixar uma configuração provisória.
const PENDING_ZAMMAD_FIELDS = new Set(["acesso_nome", "acesso_email"]);
const summary = (groupId: number, answers: Answers = {}) =>
  Object.fromEntries(
    resolve(groupId, answers)
      .fields.filter((field) => !PENDING_ZAMMAD_FIELDS.has(field.name))
      .map((field) => [field.name, field.required ? "obrigatório" : "opcional"]),
  );

describe("recorte real: formulários de Tecnologia (cliente)", () => {
  it("nenhuma regra da tela de criação fica sem avaliar", () => {
    expect(built.unsupported).toEqual([]);
  });

  it("Desenvolvimento: tipo e sistema obrigatórios, data opcional, prioridade sugerida obrigatória", () => {
    expect(summary(DEV)).toEqual({
      prioridade_cliente: "obrigatório",
      tipo_demanda: "obrigatório",
      sistema_afetado: "obrigatório",
      data_atendimento: "opcional",
    });
  });

  it("Desenvolvimento + Portal do Colaborador: pergunta a ferramenta, obrigatória (bug da v1.10.1)", () => {
    expect(summary(DEV, { sistema_afetado: "portal" }).ferramenta_portal).toBe("obrigatório");
    const steps = resolve(DEV, { sistema_afetado: "portal" }).steps.map((step) => step.fields.map((field) => field.name));
    expect(steps.find((names) => names.includes("sistema_afetado"))).toEqual(["sistema_afetado", "ferramenta_portal"]);
  });

  it("Desenvolvimento + Broadcast e TVs: pergunta as telas (múltipla escolha), obrigatórias; a ferramenta some", () => {
    const resolved = resolve(DEV, { sistema_afetado: "broadcast", ferramenta_portal: "colabora" });
    expect(summary(DEV, { sistema_afetado: "broadcast" }).telas_afetadas).toBe("obrigatório");
    expect(resolved.fields.find((field) => field.name === "telas_afetadas")?.type).toBe("multiselect");
    expect(resolved.answers.ferramenta_portal).toBeUndefined();
  });

  it("o envio sem a ferramenta é recusado antes de chegar ao Zammad", () => {
    const resolved = resolve(DEV, { prioridade_cliente: "2", tipo_demanda: Object.keys(attributeOptions("tipo_demanda"))[0], sistema_afetado: "portal" });
    expect(Object.keys(validateFields(resolved.fields, resolved.answers))).toEqual(["ferramenta_portal"]);
  });

  it("Suporte: local e item obrigatórios; identificação do equipamento e data opcionais", () => {
    expect(summary(SUPORTE)).toMatchObject({
      local_fisico: "obrigatório",
      item_atendimento: "obrigatório",
      identificacao_equipamento: "opcional",
      data_atendimento: "opcional",
    });
  });

  it("Infraestrutura: natureza, serviço e alcance obrigatórios; local e data opcionais", () => {
    expect(summary(INFRA)).toMatchObject({
      natureza_chamado: "obrigatório",
      servico_afetado: "obrigatório",
      alcance: "obrigatório",
      local_fisico: "opcional",
      data_atendimento: "opcional",
    });
  });

  it("Acesso a sistemas: tipo, sistema e para quem obrigatórios; data opcional", () => {
    expect(summary(ACESSO)).toMatchObject({
      tipo_solicitacao: "obrigatório",
      sistema_acesso: "obrigatório",
      acesso_para_quem: "obrigatório",
      data_atendimento: "opcional",
    });
  });
});

describe("recorte real: chamado filho (agente)", () => {
  it("Desenvolvimento para agente: sem prioridade sugerida, ferramenta condicional igual", () => {
    const form = buildChildForm(FEM_SCHEMA_LIVE, EMPTY, DEV, { roleIds: [] })!;
    expect(form.fields.map((field) => field.name)).not.toContain("prioridade_cliente");
    const resolved = resolveForm(form.rules, DEV, form.presentation, { sistema_afetado: "portal" });
    expect(resolved.fields.find((field) => field.name === "ferramenta_portal")?.required).toBe(true);
  });
});

describe("recorte real: tela de edição (base da etapa 2)", () => {
  const agentRoles = [2];
  const edit = (selected: Record<string, unknown>, saved: Record<string, unknown>) =>
    evaluateWorkflows(FEM_SCHEMA_LIVE.attributes, FEM_SCHEMA_LIVE.workflows, {
      screen: "edit",
      ticket: { group_id: String(DEV), ...selected },
      saved: { group_id: String(DEV), ...saved },
      session: { roleIds: agentRoles, userId: 1 },
      role: "ticket.agent",
    }).fields;

  it("entrar em Atribuído (10) ou Em andamento (8) vindo de outro estado exige tempo e prazo (regra 810)", () => {
    for (const target of ["10", "8"]) {
      const fields = edit({ state_id: target }, { state_id: "7" });
      expect(fields.tempo_previsto.mandatory, `7 → ${target}`).toBe(true);
      expect(fields.prazo_entrega.mandatory, `7 → ${target}`).toBe(true);
    }
    // De Atribuído para Em andamento não exige de novo (já foi exigido ao atribuir).
    expect(edit({ state_id: "8" }, { state_id: "10" }).tempo_previsto.mandatory).toBe(false);
  });

  it("Em pausa (11) exige o motivo da pausa (regra 800)", () => {
    expect(edit({ state_id: "11" }, { state_id: "8" }).motivo_pausa).toMatchObject({ visible: true, mandatory: true });
    expect(edit({ state_id: "8" }, { state_id: "8" }).motivo_pausa.visible).toBe(false);
  });
});

function attributeOptions(name: string): Record<string, string> {
  const attribute = FEM_SCHEMA_LIVE.attributes.find((candidate) => candidate.name === name)!;
  return attribute.data_option.options as Record<string, string>;
}
