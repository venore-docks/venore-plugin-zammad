import { describe, expect, it } from "vitest";
import type { WizardConfig } from "../contracts/types";
import { FEM_SCHEMA } from "./__fixtures__/fem-schema";
import { DEFAULT_GROUP_CONFIG, buildSectorForms } from "./form";

const EMPTY: WizardConfig = { intro: null, groups: {} };

describe("buildSectorForms", () => {
  it("um setor por grupo ativo, subgrupo com parentId, em ordem alfabética", () => {
    const { sectors } = buildSectorForms(FEM_SCHEMA, EMPTY);
    expect(sectors).toHaveLength(13);
    const photo = sectors.find((sector) => sector.groupId === 8);
    expect(photo).toMatchObject({ label: "Cobertura fotográfica", parentId: 7 });
    const labels = sectors.map((sector) => sector.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("Marketing: escolhas sozinhas, datas juntas, perguntas rápidas em lote e o opcional no fim", () => {
    const marketing = buildSectorForms(FEM_SCHEMA, EMPTY).sectors.find((sector) => sector.groupId === 6)!;
    expect(marketing.steps.map((step) => [step.title, step.fields.map((field) => field.name), step.optional])).toEqual([
      ["Materiais desejados", ["materiais_desejados"], false],
      ["Quem é o público alvo?", ["publico_alvo"], false],
      ["Para quando?", ["data_de_uso", "data_material_pronto"], false],
      ["Só mais algumas perguntas", ["orcamento_previo", "material_referencia", "orientacao_especifica_comunicacao"], false],
      ["Quer ajustar mais alguma coisa?", ["prioridade_cliente"], true],
    ]);
    const fields = marketing.steps.flatMap((step) => step.fields);
    const byName = Object.fromEntries(fields.map((field) => [field.name, field]));
    expect(byName.materiais_desejados.type).toBe("multiselect");
    expect(byName.materiais_desejados.options.map((o) => o.label)).toContain("cobertura fotográfica");
    expect(byName.orcamento_previo).toMatchObject({ type: "boolean", defaultValue: null });
    expect(byName.orcamento_previo.options).toEqual([
      { value: "true", label: "sim" },
      { value: "false", label: "não" },
    ]);
    expect(byName.data_de_uso).toMatchObject({ type: "datetime", allowFuture: true, allowPast: false, required: true });
    // Prioridade inicial tem padrão "2" (Normal) no Zammad.
    expect(byName.prioridade_cliente).toMatchObject({ type: "select", defaultValue: "2", required: false });
  });

  it("Manutenção: local obrigatório sozinho e uma etapa opcional; Ocorrências: só a data", () => {
    const sectors = buildSectorForms(FEM_SCHEMA, EMPTY).sectors;
    const maintenance = sectors.find((sector) => sector.groupId === 1)!;
    expect(maintenance.steps.map((step) => [step.fields.map((field) => field.name), step.optional])).toEqual([
      [["local_fisico"], false],
      [["prioridade_cliente", "data_atendimento"], true],
    ]);
    const occurrences = sectors.find((sector) => sector.groupId === 13)!;
    expect(occurrences.steps.map((step) => [step.title, step.fields.map((field) => field.name)])).toEqual([["Data da Ocorrência", ["data_ocorrencia"]]]);
  });

  it("agrupa campos com o mesmo número de etapa e usa o título configurado", () => {
    const config: WizardConfig = {
      intro: null,
      groups: {
        "6": {
          ...DEFAULT_GROUP_CONFIG,
          label: "Marketing e Comunicação",
          fieldSteps: { data_de_uso: 1, data_material_pronto: 1, materiais_desejados: 2 },
          stepTitles: { "1": "Quando?" },
          fieldHelp: { data_material_pronto: "Conte pelo menos 5 dias úteis." },
        },
      },
    };
    const marketing = buildSectorForms(FEM_SCHEMA, config).sectors.find((sector) => sector.groupId === 6)!;
    expect(marketing.label).toBe("Marketing e Comunicação");
    expect(marketing.steps[0].title).toBe("Quando?");
    expect(marketing.steps[0].fields.map((field) => field.name)).toEqual(["data_de_uso", "data_material_pronto"]);
    expect(marketing.steps[0].fields[1].help).toBe("Conte pelo menos 5 dias úteis.");
    expect(marketing.steps[1].fields.map((field) => field.name)).toEqual(["materiais_desejados"]);
    // 2 etapas configuradas + restantes automáticos: público, [rápidas ×3], opcional.
    expect(marketing.steps.map((step) => step.key)).toEqual(["step-1", "step-2", "auto-1", "auto-2", "auto-3"]);
  });

  it("setor oculto some para quem abre chamado, mas continua na visão do admin", () => {
    const config: WizardConfig = { intro: null, groups: { "12": { ...DEFAULT_GROUP_CONFIG, enabled: false } } };
    expect(buildSectorForms(FEM_SCHEMA, config).sectors.some((sector) => sector.groupId === 12)).toBe(false);
    expect(buildSectorForms(FEM_SCHEMA, config, { includeDisabled: true }).sectors.some((sector) => sector.groupId === 12)).toBe(true);
  });
});
