import { describe, expect, it } from "vitest";
import { canAllocate, canEditTicket, canSeeQueue, canWorkTicket, isSupervisor, isUnassigned, staffRoleOf, viewerMode, type StaffRole } from "./access-rules";

const base = { customerId: 10, ownerId: 20, meId: 99, role: "customer" as StaffRole, asAgent: true };

describe("staffRoleOf (papéis reais do Zammad da FEM)", () => {
  const CLIENTES = ["ticket.customer", "user_preferences.appearance"];
  const AGENTE_MARKETING = ["ticket.agent"];
  const GESTOR_MARKETING = ["report", "ticket.agent"];
  const ADMIN = ["admin", "knowledge_base.editor", "report", "ticket.agent", "ticket.customer"];

  it("cliente, agente, gestor e admin", () => {
    expect(staffRoleOf([CLIENTES])).toBe("customer");
    expect(staffRoleOf([CLIENTES, AGENTE_MARKETING])).toBe("agent");
    expect(staffRoleOf([CLIENTES, AGENTE_MARKETING, GESTOR_MARKETING])).toBe("manager");
    expect(staffRoleOf([CLIENTES, ADMIN])).toBe("admin");
    expect(staffRoleOf([])).toBe("customer");
  });

  it("`report` sozinho (sem ticket.agent) não faz ninguém gestor", () => {
    expect(staffRoleOf([["report"]])).toBe("customer");
  });
});

describe("viewerMode", () => {
  it("solicitante vê o próprio chamado; chamado alheio não aparece", () => {
    expect(viewerMode({ ...base, meId: 10 })).toBe("customer");
    expect(viewerMode({ ...base })).toBeNull();
  });

  it("colaborador comum nunca vira agente, mesmo pedindo a visão de agente", () => {
    expect(viewerMode({ ...base, meId: 20 })).toBeNull();
  });

  it("agente: só o que está com ele — NÃO vê a fila nem o chamado de outro agente", () => {
    const agent = { ...base, meId: 20, role: "agent" as StaffRole };
    expect(viewerMode(agent)).toBe("agent");
    expect(viewerMode({ ...agent, ownerId: 1 })).toBeNull();
    expect(viewerMode({ ...agent, ownerId: null })).toBeNull();
    expect(viewerMode({ ...agent, ownerId: 77 })).toBeNull();
  });

  it("gestor e admin: veem fila e chamados de qualquer agente (o Zammad já restringe aos grupos)", () => {
    for (const role of ["manager", "admin"] as StaffRole[]) {
      const sup = { ...base, meId: 50, role };
      expect(viewerMode(sup)).toBe("agent");
      expect(viewerMode({ ...sup, ownerId: 1 })).toBe("agent");
    }
  });

  it("no portal comum (sem asAgent) ninguém tem visão de agente", () => {
    expect(viewerMode({ ...base, meId: 50, role: "admin", asAgent: false })).toBeNull();
    expect(viewerMode({ ...base, meId: 10, role: "admin", asAgent: false })).toBe("customer");
  });

  it("agente que também é o solicitante: com o chamado dele tem controles de agente; em chamado de outro agente, só a visão de solicitante", () => {
    const self = { ...base, customerId: 20, meId: 20, role: "agent" as StaffRole };
    expect(viewerMode(self)).toBe("agent");
    expect(viewerMode({ ...self, ownerId: 77 })).toBe("customer");
  });
});

describe("o que cada papel pode fazer no chamado", () => {
  it("só o agente com o chamado responde; gestor supervisiona mas só responde o que é dele", () => {
    expect(canWorkTicket("agent", 20, 20)).toBe(true);
    expect(canWorkTicket("agent", 1, 20)).toBe(false);
    expect(canWorkTicket("agent", 77, 20)).toBe(false);
    expect(canWorkTicket("customer", 20, 20)).toBe(false);
  });

  it("alocar é só de gestor/admin", () => {
    expect(canAllocate("agent", "agent")).toBe(false);
    expect(canAllocate("agent", "manager")).toBe(true);
    expect(canAllocate("agent", "admin")).toBe(true);
    expect(canAllocate("customer", "admin")).toBe(false);
  });

  it("estado/prioridade: agente só no dele; gestor também no da equipe", () => {
    expect(canEditTicket("agent", "agent", 20, 20)).toBe(true);
    expect(canEditTicket("agent", "agent", 77, 20)).toBe(false);
    expect(canEditTicket("agent", "manager", 77, 20)).toBe(true);
  });

  it("fila: só supervisores", () => {
    expect(["customer", "agent", "manager", "admin"].map((role) => canSeeQueue(role as StaffRole))).toEqual([false, false, true, true]);
    expect(isSupervisor("manager")).toBe(true);
  });

  it("sem responsável = id 1, nulo ou 0", () => {
    expect([1, null, undefined, 0].map(isUnassigned)).toEqual([true, true, true, true]);
    expect(isUnassigned(5)).toBe(false);
  });
});
