import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESENVOLVIMENTO, FEM_SCHEMA_CHILDREN, RECURSOS_HUMANOS, TECNOLOGIA } from "../../shared/__fixtures__/fem-schema-children";
import type { Requester } from "../../shared/requester";

// O serviço com o Zammad simulado: confere que o formulário é remontado no servidor (recusa resposta que falta e
// grupo com subgrupos) e que os campos do setor vão no payload. O recorte é o derivado (fem-schema-children).

const zammadRequest = vi.fn();
vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: () => ({}), endOperation: () => undefined }));
vi.mock("@venore/plugin-sdk/brand", () => ({ getBrandConfig: async () => ({ siteName: "Portal" }) }));
vi.mock("../../shared/schema", () => ({ loadSchema: async () => ({ success: true, data: FEM_SCHEMA_CHILDREN }) }));
vi.mock("../../shared/wizard-config", () => ({ readWizardConfig: async () => ({ intro: null, appName: null, groups: {} }) }));
vi.mock("../../shared/zammad-client", () => ({ zammadRequest: (...args: unknown[]) => zammadRequest(...args) }));
vi.mock("../../shared/ticket-links", () => ({ linkChild: async () => ({ success: true, data: null }) }));
vi.mock("../../shared/directory", () => ({ assigneesFor: async () => [{ id: 7, name: "Agente" }] }));
vi.mock("../../shared/own-ticket", () => ({
  loadAgentOptions: async () => ({ success: true, data: { states: [{ id: 30, name: "Autorizado" }] } }),
  loadTicketForViewer: async () => ({
    success: true,
    data: {
      ticket: { id: 100, number: "37117", title: "Sistema de matrículas", group_id: DESENVOLVIMENTO, owner_id: 5, customer_id: 9, local_fisico: "101" },
      mode: "agent",
      role: "agent",
    },
  }),
}));

const { createChildTicket } = await import("./service");
const { getChildForm } = await import("../get-child-form/service");

const requester = { actorId: "a1", email: "agente@exemplo.org", name: "Agente", avatarMediaId: null, image: null, zammadUser: { id: 5, role_ids: [2] }, viewAs: null } as unknown as Requester;
const base = { parentId: 100, title: "Ajustar a tela de notas", description: "Precisamos ajustar a tela de notas do sistema." };

beforeEach(() => {
  zammadRequest.mockReset();
  zammadRequest.mockResolvedValue({ success: true, data: { id: 200, number: "37200" } });
});

describe("criar chamado filho", () => {
  it("subtarefa em Desenvolvimento manda local_fisico e mantém a origem na 1ª linha do artigo", async () => {
    const result = await createChildTicket(requester, { ...base, mode: "subtask", answers: { local_fisico: "101" } });
    expect(result).toEqual({ success: true, data: { id: 200, number: "37200" } });
    const payload = zammadRequest.mock.calls[0][1].body;
    expect(payload).toMatchObject({ group_id: DESENVOLVIMENTO, owner_id: 5, state_id: 30, local_fisico: "101" });
    expect(payload.article.body.startsWith("<p><em>Chamado filho de #37117 — Sistema de matrículas</em></p>")).toBe(true);
    expect(payload.article.body).toContain("Respostas do formulário");
  });

  it("recusa com a resposta obrigatória faltando, sem chamar o Zammad", async () => {
    const result = await createChildTicket(requester, { ...base, mode: "subtask", answers: {} });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toMatch(/^".+": Responda esta pergunta/);
    expect(zammadRequest).not.toHaveBeenCalled();
  });

  it("ignora campos que o navegador inventa", async () => {
    await createChildTicket(requester, { ...base, mode: "sector", groupId: RECURSOS_HUMANOS, answers: { local_fisico: "X", inventado: "y" } });
    const payload = zammadRequest.mock.calls[0][1].body;
    expect(payload.group_id).toBe(RECURSOS_HUMANOS);
    expect(payload).not.toHaveProperty("inventado");
    expect(payload).not.toHaveProperty("local_fisico");
  });

  it("recusa grupo com subgrupos pedindo o assunto", async () => {
    const result = await createChildTicket(requester, { ...base, mode: "sector", groupId: TECNOLOGIA, answers: {} });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toBe("Escolha o assunto em Tecnologia para continuar.");
    expect(zammadRequest).not.toHaveBeenCalled();
  });
});

describe("formulário do chamado filho", () => {
  it("subtarefa: campos do setor do pai com local_fisico herdado", async () => {
    const result = await getChildForm(requester, { parentId: 100, mode: "subtask" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.groupId).toBe(DESENVOLVIMENTO);
    expect(result.data.fields.find((field) => field.name === "local_fisico")?.required).toBe(true);
    expect(result.data.defaults.local_fisico).toBe("101");
  });

  it("outro setor exige grupo", async () => {
    const result = await getChildForm(requester, { parentId: 100, mode: "sector" });
    expect(result.success).toBe(false);
  });
});
