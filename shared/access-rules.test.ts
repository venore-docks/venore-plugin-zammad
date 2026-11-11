import { describe, expect, it } from "vitest";
import { canWorkTicket, isUnassigned, viewerMode } from "./access-rules";

const base = { customerId: 10, ownerId: 20, meId: 99, isAgent: false, asAgent: false };

describe("viewerMode", () => {
  it("solicitante vê o próprio chamado; chamado alheio não aparece", () => {
    expect(viewerMode({ ...base, meId: 10 })).toBe("customer");
    expect(viewerMode({ ...base })).toBeNull();
  });

  it("colaborador comum nunca vira agente, mesmo pedindo a visão de agente", () => {
    expect(viewerMode({ ...base, meId: 20, asAgent: true })).toBeNull();
    expect(viewerMode({ ...base, meId: 10, asAgent: true })).toBe("customer");
  });

  it("agente no app: vê o que é dele e a fila; chamado de outro agente não", () => {
    const agent = { ...base, meId: 20, isAgent: true, asAgent: true };
    expect(viewerMode(agent)).toBe("agent");
    expect(viewerMode({ ...agent, ownerId: 1 })).toBe("agent");
    expect(viewerMode({ ...agent, ownerId: null })).toBe("agent");
    expect(viewerMode({ ...agent, ownerId: 77 })).toBeNull();
  });

  it("agente no portal comum (sem asAgent) só vê o que abriu", () => {
    expect(viewerMode({ ...base, meId: 20, isAgent: true })).toBeNull();
    expect(viewerMode({ ...base, meId: 10, isAgent: true })).toBe("customer");
  });

  it("agente que também é o solicitante: com o chamado dele tem os controles de agente; em chamado de outro agente, só a visão de solicitante", () => {
    const self = { ...base, customerId: 20, meId: 20, isAgent: true, asAgent: true };
    expect(viewerMode(self)).toBe("agent");
    expect(viewerMode({ ...self, ownerId: 77 })).toBe("customer");
  });
});

describe("canWorkTicket / isUnassigned", () => {
  it("só trabalha o chamado que está com ele; fila é só para assumir", () => {
    expect(canWorkTicket("agent", 20, 20)).toBe(true);
    expect(canWorkTicket("agent", 1, 20)).toBe(false);
    expect(canWorkTicket("customer", 20, 20)).toBe(false);
    expect(canWorkTicket(null, 20, 20)).toBe(false);
  });

  it("sem responsável = id 1, nulo ou 0", () => {
    expect([1, null, undefined, 0].map(isUnassigned)).toEqual([true, true, true, true]);
    expect(isUnassigned(5)).toBe(false);
  });
});
