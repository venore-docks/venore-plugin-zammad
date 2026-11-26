import { describe, expect, it } from "vitest";
import {
  CUSTOMER_ACTIONS,
  allowedTargets,
  canMoveTo,
  customerActionsFor,
  customerCanReply,
  customerMustDecide,
  flowStepOf,
  isCustomerAction,
  staffActionsFor,
  staffHintFor,
  stepAfterOwnerChange,
  validateReason,
} from "./flow";
import { describeState } from "./ticket-state";

describe("flowStepOf (estados do Zammad da FEM, por nome)", () => {
  it("reconhece os nove estados, sem depender de acento ou caixa", () => {
    expect(flowStepOf("Atribuído")).toBe("atribuido");
    expect(flowStepOf("atribuida")).toBe("atribuido");
    expect(flowStepOf("Novo")).toBe("novo");
    expect(flowStepOf("Nova")).toBe("novo");
    expect(flowStepOf("Em análise")).toBe("em_analise");
    expect(flowStepOf("em analise")).toBe("em_analise");
    expect(flowStepOf("Autorizado")).toBe("autorizado");
    expect(flowStepOf("Não autorizado")).toBe("nao_autorizado");
    expect(flowStepOf("Reavaliação")).toBe("reavaliacao");
    expect(flowStepOf("Em andamento")).toBe("em_andamento");
    expect(flowStepOf("Concluído")).toBe("concluido");
    expect(flowStepOf("  FINALIZADO ")).toBe("finalizado");
  });

  it("estados padrão do Zammad ficam fora do fluxo", () => {
    expect(flowStepOf("new")).toBeNull();
    expect(flowStepOf("closed")).toBeNull();
    expect(flowStepOf("mesclado")).toBeNull();
    expect(flowStepOf(null)).toBeNull();
  });
});

describe("describeState", () => {
  it("usa o fluxo: Não autorizado e Finalizado são fechados; Concluído não", () => {
    expect(describeState("Não autorizado")).toMatchObject({ closed: true, color: "danger", step: "nao_autorizado" });
    expect(describeState("Finalizado")).toMatchObject({ closed: true, color: "neutral", tone: "closed" });
    expect(describeState("Concluído")).toMatchObject({ closed: false, color: "success", tone: "open" });
    expect(describeState("Novo")).toMatchObject({ tone: "new", color: "info" });
  });

  it("fora do fluxo mantém o comportamento antigo", () => {
    expect(describeState("closed")).toMatchObject({ label: "Encerrado", closed: true, step: null });
    expect(describeState("new")).toMatchObject({ label: "Recebido", tone: "new", step: null });
  });
});

describe("cliente", () => {
  it("Concluído: aprovar, ajustes, não resolvido e rejeitar; Não autorizado: reenviar", () => {
    expect(customerActionsFor("concluido")).toEqual(["approve", "adjust", "not_solved", "reject"]);
    expect(customerActionsFor("nao_autorizado")).toEqual(["resubmit"]);
    expect(customerActionsFor("em_andamento")).toEqual([]);
    expect(customerActionsFor(null)).toEqual([]);
  });

  it("palavras de controle combinadas com os gatilhos do Zammad", () => {
    expect(CUSTOMER_ACTIONS.approve.word).toBe("[APROVADO]");
    expect(CUSTOMER_ACTIONS.adjust.word).toBe("[AJUSTAR]");
    expect(CUSTOMER_ACTIONS.reject.word).toBe("[REJEITADO]");
    expect(CUSTOMER_ACTIONS.not_solved.word).toBe("[NAO_RESOLVIDO]");
    expect(CUSTOMER_ACTIONS.resubmit.word).toBe("[REENVIAR]");
  });

  it("só aprovar dispensa explicação", () => {
    const required = Object.entries(CUSTOMER_ACTIONS).filter(([, info]) => info.reasonRequired).map(([key]) => key);
    expect(required.sort()).toEqual(["adjust", "not_solved", "reject", "resubmit"]);
  });

  it("mensagem comum só fora de Concluído/Não autorizado/Finalizado", () => {
    expect(customerCanReply("em_andamento")).toBe(true);
    expect(customerCanReply(null)).toBe(true);
    expect(customerCanReply("concluido")).toBe(false);
    expect(customerCanReply("nao_autorizado")).toBe(false);
    expect(customerCanReply("finalizado")).toBe(false);
  });

  it("Concluído e Não autorizado esperam o solicitante", () => {
    expect(customerMustDecide("concluido")).toBe(true);
    expect(customerMustDecide("nao_autorizado")).toBe(true);
    expect(customerMustDecide("em_analise")).toBe(false);
  });

  it("isCustomerAction recusa o que não é ação", () => {
    expect(isCustomerAction("approve")).toBe(true);
    expect(isCustomerAction("close")).toBe(false);
    expect(isCustomerAction(3)).toBe(false);
  });
});

describe("equipe (espelha os Core Workflows 600–607)", () => {
  const gestor = { supervisor: true, worker: false };
  const agente = { supervisor: false, worker: true };
  const ambos = { supervisor: true, worker: true };

  it("gestor decide de Novo até Autorizado, e na Reavaliação", () => {
    expect(allowedTargets("novo", gestor).sort()).toEqual(["autorizado", "em_analise", "nao_autorizado", "reavaliacao"]);
    expect(canMoveTo("reavaliacao", "autorizado", gestor)).toBe(true);
    expect(canMoveTo("em_andamento", "concluido", gestor)).toBe(false);
    expect(allowedTargets("nao_autorizado", gestor)).toEqual([]);
    expect(allowedTargets("finalizado", gestor)).toEqual([]);
  });

  it("Atribuído: o agente só inicia o atendimento (não conclui direto); o gestor não muda o estado", () => {
    expect(allowedTargets("atribuido", agente)).toEqual(["em_andamento"]);
    expect(canMoveTo("atribuido", "concluido", agente)).toBe(false);
    expect(allowedTargets("atribuido", gestor)).toEqual([]);
    expect(staffActionsFor("atribuido", agente)).toMatchObject([{ target: "em_andamento", label: "Iniciar atendimento" }]);
    expect(staffActionsFor("concluido", agente)).toMatchObject([{ target: "em_andamento", label: "Voltar para em andamento" }]);
    expect(staffHintFor("atribuido", { ...agente, hasOwner: true })).toMatch(/Iniciar atendimento/);
    expect(staffHintFor("atribuido", { ...gestor, hasOwner: true })).toMatch(/Aguardando o responsável/);
  });

  it("dar responsável a Autorizado leva a Atribuído; devolver Atribuído à fila volta a Autorizado", () => {
    expect(stepAfterOwnerChange("autorizado", true)).toBe("atribuido");
    expect(stepAfterOwnerChange("atribuido", false)).toBe("autorizado");
    expect(stepAfterOwnerChange("atribuido", true)).toBeNull();
    expect(stepAfterOwnerChange("em_andamento", true)).toBeNull();
    expect(stepAfterOwnerChange("em_andamento", false)).toBeNull();
    expect(stepAfterOwnerChange(null, true)).toBeNull();
  });

  it("agente só alterna entre Em andamento e Concluído", () => {
    expect(allowedTargets("em_andamento", agente)).toEqual(["concluido"]);
    expect(allowedTargets("concluido", agente)).toEqual(["em_andamento"]);
    expect(canMoveTo("novo", "autorizado", agente)).toBe(false);
    expect(canMoveTo("em_andamento", "finalizado", agente)).toBe(false);
  });

  it("gestor que também é o responsável soma as duas listas", () => {
    expect(allowedTargets("em_andamento", ambos)).toEqual(["concluido"]);
    expect(allowedTargets("autorizado", ambos).sort()).toEqual(["em_analise", "nao_autorizado", "reavaliacao"]);
  });

  it("botões: Não autorizar exige motivo; Concluir aceita texto opcional", () => {
    const novo = staffActionsFor("novo", gestor);
    expect(novo.map((action) => action.target)).toEqual(["em_analise", "autorizado", "nao_autorizado"]);
    expect(novo.find((action) => action.target === "nao_autorizado")?.reason).toBe("required");
    expect(staffActionsFor("em_andamento", agente)).toMatchObject([{ target: "concluido", reason: "optional", color: "success" }]);
  });

  it("dica: autorizado sem responsável pede atribuição", () => {
    expect(staffHintFor("autorizado", { ...gestor, hasOwner: false })).toMatch(/Atribua.*Atribuído/);
    expect(staffHintFor("autorizado", { ...gestor, hasOwner: true })).toBeNull();
  });
});

describe("validateReason", () => {
  it("obrigatório exige texto; opcional aceita vazio; limite de tamanho", () => {
    expect(validateReason("", true)).not.toBeNull();
    expect(validateReason("  ok ", true)).not.toBeNull();
    expect(validateReason("ficou torto", true)).toBeNull();
    expect(validateReason("", false)).toBeNull();
    expect(validateReason("x".repeat(4001), false)).not.toBeNull();
  });
});
