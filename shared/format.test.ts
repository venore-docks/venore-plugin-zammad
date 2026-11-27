import { describe, expect, it } from "vitest";
import { elapsedLabel, elapsedSince, formatGroupName, stripLeadingNumber, stripNumbersFromOptions } from "./format";
import { priorityLabel } from "./ticket-options";

const MIN = 60 * 1000;
const H = 60 * MIN;

describe("elapsedLabel (uma forma só de dizer há quanto tempo)", () => {
  it("agora, minutos, horas e dias, sempre com “há”", () => {
    expect(elapsedLabel(20 * 1000)).toBe("agora há pouco");
    expect(elapsedLabel(2 * MIN)).toBe("há 2 min");
    expect(elapsedLabel(59 * MIN)).toBe("há 59 min");
    expect(elapsedLabel(60 * MIN)).toBe("há 1 h");
    expect(elapsedLabel(5 * H)).toBe("há 5 h");
    expect(elapsedLabel(24 * H)).toBe("há 1 d");
    expect(elapsedLabel(50 * 24 * H)).toBe("há 50 d");
    expect(elapsedLabel(-5)).toBe("agora há pouco");
  });

  it("elapsedSince a partir de uma data; data inválida não quebra", () => {
    const now = new Date("2026-11-27T15:00:00Z");
    expect(elapsedSince("2026-11-27T12:00:00Z", now)).toBe("há 3 h");
    expect(elapsedSince("lixo", now)).toBe("agora há pouco");
  });
});

describe("formatGroupName", () => {
  it("troca o separador cru do Zammad por “ > ”, em qualquer nível", () => {
    expect(formatGroupName("Tecnologia::Acesso a sistemas")).toBe("Tecnologia > Acesso a sistemas");
    expect(formatGroupName("Recursos Humanos::Plano de Cargos e Salários (PCS)")).toBe("Recursos Humanos > Plano de Cargos e Salários (PCS)");
    expect(formatGroupName("A::B::C")).toBe("A > B > C");
    expect(formatGroupName("Marketing")).toBe("Marketing");
  });
});

describe("prefixo numérico dos rótulos", () => {
  it("prioridade: “1 - Baixa” e “1 Baixa” viram “Baixa” (sem hífen sobrando)", () => {
    expect(priorityLabel("1 - Baixa")).toBe("Baixa");
    expect(priorityLabel("2 normal")).toBe("Normal");
    expect(priorityLabel("3 – alta")).toBe("Alta");
    expect(priorityLabel("4 Urgente")).toBe("Urgente");
    expect(priorityLabel("Crítica")).toBe("Crítica");
  });

  it("stripLeadingNumber não esvazia o rótulo", () => {
    expect(stripLeadingNumber("3. Alta")).toBe("Alta");
    expect(stripLeadingNumber("2026")).toBe("2026");
  });

  it("só tira o número de uma lista toda numerada (prioridade sugerida)", () => {
    const priorities = [
      { value: "1", label: "1 Baixa" },
      { value: "2", label: "2 Normal" },
    ];
    expect(stripNumbersFromOptions(priorities).map((option) => option.label)).toEqual(["Baixa", "Normal"]);
    const mixed = [
      { value: "a", label: "2 monitores" },
      { value: "b", label: "Teclado" },
    ];
    expect(stripNumbersFromOptions(mixed).map((option) => option.label)).toEqual(["2 monitores", "Teclado"]);
  });
});
