import { describe, expect, it } from "vitest";
import type { WizardConfig } from "../contracts/types";
import { FEM_SCHEMA } from "./__fixtures__/fem-schema";
import { DEFAULT_GROUP_CONFIG, buildSectorForms } from "./form";

const EMPTY: WizardConfig = { intro: null, appName: null, groups: {} };

describe("buildSectorForms", () => {
  it("um setor por grupo ativo, subgrupo com parentId, em ordem alfabética", () => {
    const { sectors } = buildSectorForms(FEM_SCHEMA, EMPTY);
    expect(sectors).toHaveLength(13);
    const photo = sectors.find((sector) => sector.groupId === 8);
    expect(photo).toMatchObject({ label: "Cobertura fotográfica", parentId: 7 });
    const labels = sectors.map((sector) => sector.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("prioridade nunca é perguntada ao solicitante (quem define é o gestor)", () => {
    const names = buildSectorForms(FEM_SCHEMA, EMPTY).sectors.flatMap((sector) => sector.steps.flatMap((step) => step.fields.map((field) => field.name)));
    expect(names).not.toContain("prioridade_cliente");
    expect(names).not.toContain("priority_id");
  });

  it("Marketing: escolhas sozinhas, datas juntas, perguntas rápidas em lote e o opcional no fim", () => {
    const marketing = buildSectorForms(FEM_SCHEMA, EMPTY).sectors.find((sector) => sector.groupId === 6)!;
    expect(marketing.steps.map((step) => [step.title, step.fields.map((field) => field.name), step.optional])).toEqual([
      ["Materiais desejados", ["materiais_desejados"], false],
      ["Quem é o público alvo?", ["publico_alvo"], false],
      ["Para quando?", ["data_de_uso", "data_material_pronto"], false],
      ["Só mais algumas perguntas", ["orcamento_previo", "material_referencia", "orientacao_especifica_comunicacao"], false],
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
  });

  it("Manutenção: local obrigatório sozinho e uma etapa opcional; Ocorrências: só a data", () => {
    const sectors = buildSectorForms(FEM_SCHEMA, EMPTY).sectors;
    const maintenance = sectors.find((sector) => sector.groupId === 1)!;
    expect(maintenance.steps.map((step) => [step.fields.map((field) => field.name), step.optional])).toEqual([
      [["local_fisico"], false],
      [["data_atendimento"], true],
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
    // 2 etapas configuradas + restantes automáticos: público e [rápidas ×3] (a prioridade não é perguntada).
    expect(marketing.steps.map((step) => step.key)).toEqual(["step-1", "step-2", "auto-1", "auto-2"]);
  });

  it("setor oculto some para quem abre chamado, mas continua na visão do admin", () => {
    const config: WizardConfig = { intro: null, appName: null, groups: { "12": { ...DEFAULT_GROUP_CONFIG, enabled: false } } };
    expect(buildSectorForms(FEM_SCHEMA, config).sectors.some((sector) => sector.groupId === 12)).toBe(false);
    expect(buildSectorForms(FEM_SCHEMA, config, { includeDisabled: true }).sectors.some((sector) => sector.groupId === 12)).toBe(true);
  });

  describe("audiência dos setores", () => {
    const config: WizardConfig = {
      intro: null,
      appName: null,
      groups: {
        // Marketing: só o grupo de pessoas "ti". Setor 7 (pai) restrito a "rh"; filhos 8 e 9 herdam.
        "6": { ...DEFAULT_GROUP_CONFIG, audience: { mode: "groups", groupIds: ["ti"] } },
        "7": { ...DEFAULT_GROUP_CONFIG, audience: { mode: "groups", groupIds: ["rh"] } },
      },
    };
    const ids = (viewer: { isAdmin: boolean; groupIds: string[] }) => buildSectorForms(FEM_SCHEMA, config, { viewer }).sectors.map((sector) => sector.groupId);

    it("sem viewer não filtra (visão de quem monta o admin)", () => {
      expect(buildSectorForms(FEM_SCHEMA, config).sectors).toHaveLength(13);
    });

    it("quem não está em nenhum grupo só vê os setores de todos", () => {
      const seen = ids({ isAdmin: false, groupIds: [] });
      expect(seen).not.toContain(6);
      expect(seen).not.toContain(7);
      expect(seen).not.toContain(8);
      expect(seen).toContain(1);
      expect(seen).toHaveLength(13 - 4);
    });

    it("o grupo libera o setor e os subgrupos que herdam", () => {
      expect(ids({ isAdmin: false, groupIds: ["ti"] })).toContain(6);
      const rh = ids({ isAdmin: false, groupIds: ["rh"] });
      expect(rh).toEqual(expect.arrayContaining([7, 8, 9]));
      expect(rh).not.toContain(6);
    });

    it("admin vê todos os setores (prévia)", () => {
      expect(ids({ isAdmin: true, groupIds: [] })).toHaveLength(13);
    });
  });
});
