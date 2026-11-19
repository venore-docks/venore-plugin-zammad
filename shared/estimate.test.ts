import { describe, expect, it } from "vitest";
import type { ZammadAttribute } from "../contracts/zammad";
import { estimateLabel, estimateOptions, parseEstimate } from "./estimate";

const attribute = (overrides: Partial<ZammadAttribute> = {}): ZammadAttribute => ({
  name: "tempo_previsto",
  object: "Ticket",
  display: "Tempo previsto",
  data_type: "select",
  active: true,
  editable: true,
  position: 900,
  data_option: { options: { "1h": "1 hora", "2d": "2 dias", "1s": "1 semana" } },
  screens: {},
  ...overrides,
});

describe("tempo previsto", () => {
  it("lê as opções do campo do Zammad", () => {
    expect(estimateOptions([attribute()])).toEqual([
      { value: "1h", label: "1 hora" },
      { value: "2d", label: "2 dias" },
      { value: "1s", label: "1 semana" },
    ]);
  });

  it("sem o campo (ou desativado) a função some", () => {
    expect(estimateOptions([])).toBeNull();
    expect(estimateOptions([attribute({ active: false })])).toBeNull();
  });

  it("rótulo do valor salvo; vazio = sem previsão", () => {
    const options = estimateOptions([attribute()]) ?? [];
    expect(estimateLabel(options, "2d")).toBe("2 dias");
    expect(estimateLabel(options, "")).toBeNull();
    expect(estimateLabel(options, null)).toBeNull();
    expect(estimateLabel(options, "9x")).toBe("9x");
  });

  it("valida o valor enviado: opção existente ou limpar", () => {
    const options = estimateOptions([attribute()]) ?? [];
    expect(parseEstimate(options, "1s")).toEqual({ ok: true, value: "1s" });
    expect(parseEstimate(options, "")).toEqual({ ok: true, value: null });
    expect(parseEstimate(options, "3 anos")).toEqual({ ok: false });
  });
});
