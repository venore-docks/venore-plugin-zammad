import { describe, expect, it } from "vitest";
import { DEV_CONDITIONAL_SCHEMA } from "./__fixtures__/dev-conditional-schema";
import { FEM_SCHEMA_LIVE } from "./__fixtures__/fem-schema-live";
import { validateField } from "./answers";
import type { WizardField } from "../contracts/types";
import { buildSectorForms, resolveForm } from "./form";
import { allowedTargets, canMoveTo, customerMustDecide, flowStepOf, staffActionsFor } from "./flow";
import { QUEUE_BUCKETS, STAGES, STAGE_GROUPS, bucketOf, countBuckets } from "./queue-buckets";
import { requesterRepliedAfterAgent } from "./requester-reply";
import { isAwaitingDecision, isAwaitingRequester, isCustomerWaiting, isOpenTicket } from "./ticket-state";

// Regras únicas de contagem (v1.14.0) e o estado "Aguardando solicitante" (id 12 no Zammad da FEM).

describe("aberto, aguardando decisão e aguardando solicitante", () => {
  it("só Finalizado encerra; Concluído e Não autorizado continuam abertos", () => {
    for (const state of ["Novo", "Em análise", "Autorizado", "Atribuído a agente", "Em andamento", "Em pausa", "Aguardando solicitante", "Concluído", "Não autorizado", "Reavaliação"]) {
      expect(isOpenTicket({ state }), state).toBe(true);
    }
    expect(isOpenTicket({ state: "Finalizado" })).toBe(false);
  });

  it("aguardam decisão do gestor: Novo, Em análise, Autorizado e Reavaliação (com ou sem responsável)", () => {
    for (const state of ["Novo", "Em análise", "Autorizado", "Reavaliação"]) expect(isAwaitingDecision({ state }), state).toBe(true);
    for (const state of ["Atribuído a agente", "Em andamento", "Em pausa", "Aguardando solicitante", "Concluído", "Não autorizado", "Finalizado"]) {
      expect(isAwaitingDecision({ state }), state).toBe(false);
    }
  });

  it("Aguardando solicitante é reconhecido pelo nome", () => {
    expect(isAwaitingRequester({ state: "Aguardando solicitante" })).toBe(true);
    expect(isAwaitingRequester({ state: "Em andamento" })).toBe(false);
    expect(flowStepOf("Aguardando solicitante")).toBe("aguardando_solicitante");
  });
});

describe("solicitante respondeu (carimbos do chamado)", () => {
  const base = { state: "Em andamento", owner_id: 7, customer_id: 9, created_at: "2026-11-20T10:00:00Z" };

  it("a abertura do chamado não conta (só o contato do solicitante, na hora da criação)", () => {
    expect(isCustomerWaiting({ ...base, state: "Novo", last_contact_customer_at: "2026-11-20T10:00:05Z", last_contact_agent_at: null })).toBe(false);
  });

  it("escreveu de novo depois de abrir, e a equipe ainda não respondeu: conta", () => {
    expect(isCustomerWaiting({ ...base, last_contact_customer_at: "2026-11-21T09:00:00Z", last_contact_agent_at: null })).toBe(true);
  });

  it("só conta depois da última resposta da equipe", () => {
    expect(isCustomerWaiting({ ...base, last_contact_customer_at: "2026-11-21T11:00:00Z", last_contact_agent_at: "2026-11-21T10:00:00Z" })).toBe(true);
    expect(isCustomerWaiting({ ...base, last_contact_customer_at: "2026-11-21T09:00:00Z", last_contact_agent_at: "2026-11-21T10:00:00Z" })).toBe(false);
  });

  it("chamado que o próprio responsável abriu não tem outro solicitante", () => {
    expect(isCustomerWaiting({ ...base, owner_id: 9, customer_id: 9, last_contact_customer_at: "2026-11-21T11:00:00Z", last_contact_agent_at: "2026-11-21T10:00:00Z" })).toBe(false);
  });

  it("em Aguardando solicitante quem espera é o solicitante: não conta", () => {
    expect(isCustomerWaiting({ ...base, state: "Aguardando solicitante", last_contact_customer_at: "2026-11-21T11:00:00Z", last_contact_agent_at: "2026-11-21T10:00:00Z" })).toBe(false);
  });
});

describe("solicitante respondeu (conversa do chamado)", () => {
  const options = { awaitingRequester: false, ownerIsRequester: false };
  const m = (role: "me" | "team" | "customer" | "system", internal = false) => ({ role, internal });

  it("só a abertura: não conta", () => {
    expect(requesterRepliedAfterAgent([m("customer")], options)).toBe(false);
  });

  it("abertura + resposta da equipe: a vez é do solicitante, não conta", () => {
    expect(requesterRepliedAfterAgent([m("customer"), m("team")], options)).toBe(false);
  });

  it("abertura + equipe + solicitante: conta", () => {
    expect(requesterRepliedAfterAgent([m("customer"), m("me"), m("customer")], options)).toBe(true);
  });

  it("nota interna da equipe não é resposta ao solicitante", () => {
    expect(requesterRepliedAfterAgent([m("customer"), m("team", true), m("customer")], options)).toBe(true);
    expect(requesterRepliedAfterAgent([m("customer"), m("customer"), m("team")], options)).toBe(false);
  });

  it("mensagem de sistema não conta e não desloca a abertura", () => {
    expect(requesterRepliedAfterAgent([m("system"), m("customer"), m("system")], options)).toBe(false);
  });

  it("aguardando solicitante e chamado aberto pelo próprio responsável: nunca", () => {
    expect(requesterRepliedAfterAgent([m("customer"), m("me"), m("customer")], { ...options, awaitingRequester: true })).toBe(false);
    expect(requesterRepliedAfterAgent([m("customer"), m("me"), m("customer")], { ...options, ownerIsRequester: true })).toBe(false);
  });
});

describe("Fila: etapa Aguardando solicitante e grupos", () => {
  it("o estado novo tem etapa própria, ao lado de Em pausa", () => {
    expect(bucketOf("aguardando_solicitante", true)).toBe("aguardando");
    const keys = QUEUE_BUCKETS.map((bucket) => bucket.key);
    expect(keys.indexOf("aguardando")).toBe(keys.indexOf("pausa") + 1);
  });

  it("estado desconhecido não cai em silêncio em Em andamento/Novo quando o Zammad tem o fluxo da FEM", () => {
    expect(bucketOf(null, true, false, true)).toBe("outros");
    expect(bucketOf(null, false, false, true)).toBe("outros");
    // Zammad genérico (sem os estados do fluxo): o comportamento antigo.
    expect(bucketOf(null, true, false, false)).toBe("andamento");
    expect(bucketOf(null, false, false, false)).toBe("novo");
    expect(bucketOf(null, true, true, true)).toBeNull();
  });

  it("os grupos da navegação cobrem cada etapa exatamente uma vez", () => {
    const grouped = STAGE_GROUPS.flatMap((group) => group.keys);
    expect([...grouped].sort()).toEqual(STAGES.map((stage) => stage.key).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("a contagem de Em aberto soma todas as etapas abertas, inclusive as novas", () => {
    const counts = countBuckets([{ bucket: "novo" }, { bucket: "aguardando" }, { bucket: "outros" }, { bucket: "finalizado" }] as { bucket: never }[]);
    expect(counts.abertos).toBe(3);
  });
});

describe("fluxo: Aguardando solicitante", () => {
  const agente = { supervisor: false, worker: true };
  const gestor = { supervisor: true, worker: false };

  it("Em andamento → Aguardando solicitante, e de lá só volta para Em andamento (regras 650 e 652 do Zammad)", () => {
    expect(canMoveTo("em_andamento", "aguardando_solicitante", agente)).toBe(true);
    expect(canMoveTo("em_andamento", "aguardando_solicitante", gestor)).toBe(true);
    expect(allowedTargets("aguardando_solicitante", agente)).toEqual(["em_andamento"]);
    expect(canMoveTo("aguardando_solicitante", "concluido", agente)).toBe(false);
    expect(canMoveTo("atribuido", "aguardando_solicitante", agente)).toBe(false);
  });

  it("o botão exige o texto da pergunta e existe a saída manual", () => {
    expect(staffActionsFor("em_andamento", agente).find((action) => action.target === "aguardando_solicitante")).toMatchObject({ label: "Aguardar solicitante", reason: "required" });
    expect(staffActionsFor("aguardando_solicitante", agente)).toMatchObject([{ target: "em_andamento", label: "Retomar sem resposta" }]);
  });

  it("para o solicitante o chamado espera ele (aparece em “Aguardando você”)", () => {
    expect(customerMustDecide("aguardando_solicitante")).toBe(true);
    expect(customerMustDecide("em_andamento")).toBe(false);
  });
});

describe("campo de e-mail (acesso_email) e prioridade sem número", () => {
  const field = (extra: Partial<WizardField> = {}): WizardField => ({
    name: "acesso_email",
    label: "E-mail",
    type: "email",
    required: true,
    options: [],
    help: null,
    maxLength: 120,
    allowFuture: true,
    allowPast: true,
    defaultValue: null,
    ...extra,
  });

  it("valida o formato do e-mail", () => {
    for (const ok of ["maria@fem.org.br", " maria.souza@fem.edu.br "]) expect(validateField(field(), ok), ok).toBeNull();
    for (const bad of ["TESTE QA", "maria@", "@fem.org.br", "maria@fem", "maria souza@fem.org.br"]) expect(validateField(field(), bad), bad).not.toBeNull();
    expect(validateField(field({ required: false }), "")).toBeNull();
    expect(validateField(field(), "")).not.toBeNull();
  });

  it("no Zammad real, o atributo de tipo e-mail vira campo de e-mail", () => {
    const built = buildSectorForms(FEM_SCHEMA_LIVE, { intro: null, appName: null, groups: {} });
    const presentation = built.sectors.find((sector) => sector.groupId === 22)!.presentation;
    const resolved = resolveForm(built.rules, 22, presentation, {});
    expect(resolved.fields.find((candidate) => candidate.name === "acesso_email")?.type).toBe("email");
    expect(resolved.fields.find((candidate) => candidate.name === "acesso_nome")?.type).toBe("text");
  });

  it("prioridade sugerida: as opções saem sem o número (“Baixa”, não “1 Baixa”)", () => {
    const built = buildSectorForms(FEM_SCHEMA_LIVE, { intro: null, appName: null, groups: {} });
    const presentation = built.sectors.find((sector) => sector.groupId === 21)!.presentation;
    const priority = resolveForm(built.rules, 21, presentation, {}).fields.find((candidate) => candidate.name === "prioridade_cliente");
    expect(priority?.options.map((option) => option.label)).toEqual(["Baixa", "Normal", "Alta", "Urgente"]);
  });

  it("a etapa opcional só de datas diz o que é", () => {
    const built = buildSectorForms(DEV_CONDITIONAL_SCHEMA, { intro: null, appName: null, groups: {} });
    const presentation = built.sectors.find((sector) => sector.groupId === 21)!.presentation;
    const optional = resolveForm(built.rules, 21, presentation, {}).steps.find((step) => step.optional);
    expect(optional?.fields.map((candidate) => candidate.name)).toEqual(["data_atendimento"]);
    expect(optional?.title).toBe("Alguma data de preferência?");
  });

});
