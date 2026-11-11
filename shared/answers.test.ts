import { describe, expect, it } from "vitest";
import type { WizardConfig, WizardField } from "../contracts/types";
import { FEM_SCHEMA } from "./__fixtures__/fem-schema";
import {
  composeBody,
  displayAnswer,
  localNow,
  toZammadValues,
  validateAttachments,
  validateDescription,
  validateField,
  validateFields,
  validateTitle,
} from "./answers";
import { buildSectorForms } from "./form";

const EMPTY: WizardConfig = { intro: null, appName: null, groups: {} };
const marketingFields = (): WizardField[] =>
  buildSectorForms(FEM_SCHEMA, EMPTY)
    .sectors.find((sector) => sector.groupId === 6)!
    .steps.flatMap((step) => step.fields);
const field = (name: string) => marketingFields().find((candidate) => candidate.name === name)!;

// 10/11/2026 12:00 em Brasília.
const NOW = new Date("2026-11-10T15:00:00Z");

describe("validação das respostas", () => {
  it("localNow está em UTC-3", () => {
    expect(localNow(NOW)).toBe("2026-11-10T12:00");
  });

  it("obrigatório vazio, opção fora da lista e sim/não", () => {
    expect(validateField(field("materiais_desejados"), [], NOW)).toMatch(/Responda/);
    expect(validateField(field("materiais_desejados"), ["outdoor"], NOW)).toMatch(/opções/);
    expect(validateField(field("materiais_desejados"), ["banner", "flyer"], NOW)).toBeNull();
    expect(validateField(field("orcamento_previo"), null, NOW)).toMatch(/Responda/);
    expect(validateField(field("orcamento_previo"), false, NOW)).toBeNull();
    expect(validateField(field("prioridade_cliente"), null, NOW)).toBeNull();
  });

  it("data/hora só no futuro quando o Zammad exige", () => {
    expect(validateField(field("data_de_uso"), "2026-11-10T11:00", NOW)).toMatch(/futuro/);
    expect(validateField(field("data_de_uso"), "2026-11-20T09:30", NOW)).toBeNull();
    expect(validateField(field("data_de_uso"), "20/11/2026", NOW)).toMatch(/data e hora/);
  });

  it("texto respeita o maxlength do Zammad", () => {
    expect(validateField(field("orientacao_especifica_comunicacao"), "x".repeat(201), NOW)).toMatch(/200/);
  });

  it("título, descrição e anexos", () => {
    expect(validateTitle("oi")).not.toBeNull();
    expect(validateTitle("Banner para a feira")).toBeNull();
    expect(validateDescription("curto")).not.toBeNull();
    expect(validateDescription("Preciso de um banner para a feira de ciências.")).toBeNull();
    expect(validateAttachments([{ size: 9 * 1024 * 1024 }])).toMatch(/limite/);
    expect(validateAttachments(new Array(6).fill({ size: 1 }))).toMatch(/5 arquivos/);
  });
});

describe("conversão para o Zammad", () => {
  const answers = {
    prioridade_cliente: "2",
    materiais_desejados: ["banner", "postagem"],
    orcamento_previo: false,
    publico_alvo: ["pais", "Alunos"],
    data_de_uso: "2026-11-20T09:30",
    data_material_pronto: "2026-11-18T08:00",
    material_referencia: true,
    orientacao_especifica_comunicacao: "Usar a identidade da feira",
  };

  it("valida o formulário inteiro do Marketing", () => {
    expect(validateFields(marketingFields(), answers, NOW)).toEqual({});
  });

  it("datetime ganha o fuso, booleanos e listas vão crus, vazios não vão", () => {
    const values = toZammadValues(marketingFields(), { ...answers, orientacao_especifica_comunicacao: "  " });
    expect(values.data_de_uso).toBe("2026-11-20T09:30:00-03:00");
    expect(values.orcamento_previo).toBe(false);
    expect(values.publico_alvo).toEqual(["pais", "Alunos"]);
    expect("orientacao_especifica_comunicacao" in values).toBe(false);
  });

  it("resumo legível no corpo, com HTML escapado", () => {
    expect(displayAnswer(field("publico_alvo"), ["pais", "Alunos"])).toBe("pais, alunos");
    expect(displayAnswer(field("data_de_uso"), "2026-11-20T09:30")).toBe("20/11/2026 às 09:30");
    const body = composeBody("Linha 1\nLinha <2>\n\nParágrafo", marketingFields(), answers, "Aberto pelo Portal.");
    expect(body).toContain("<p>Linha 1<br>Linha &lt;2&gt;</p><p>Parágrafo</p>");
    expect(body).toContain("<strong>Materiais desejados</strong>: banner, postagem");
    expect(body).toContain("<strong>O orçamento da produção/impressão do material, precisa ser orçado previamente?</strong>: não");
    expect(body).toContain("<em>Aberto pelo Portal.</em>");
  });
});
