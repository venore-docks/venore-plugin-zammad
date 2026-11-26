import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZammadExpandedTicket } from "../../contracts/zammad";
import type { Requester } from "../../shared/requester";

// A fila do gestor com o Zammad simulado: a aba "Em aberto" (todas as etapas abertas, até 10 linhas por etapa, sem
// tags), as abas de etapa (com tags) e o que só é buscado quando a aba precisa (encerrados).

const searchTicketsByOwner = vi.fn();
const searchOpenTicketsByOwner = vi.fn();
const loadTicketTags = vi.fn();
vi.mock("../../shared/ticket-search", () => ({
  searchTicketsByOwner: (...args: unknown[]) => searchTicketsByOwner(...args),
  searchOpenTicketsByOwner: (...args: unknown[]) => searchOpenTicketsByOwner(...args),
}));
vi.mock("../../shared/ticket-tags", () => ({ loadTicketTags: (...args: unknown[]) => loadTicketTags(...args) }));
vi.mock("../../shared/directory", () => ({
  teamFor: async () => ({ groupIds: [1], members: [{ id: 5, name: "Ana Agente" }], memberGroups: {} }),
  assigneesFor: async () => [{ id: 5, name: "Ana Agente" }],
}));
vi.mock("../../shared/people", () => ({
  getPeople: async (ids: number[]) => new Map(ids.map((id) => [id, { id, email: null, name: `Pessoa ${id}` }])),
}));
vi.mock("../../shared/own-ticket", () => ({
  loadAgentOptions: async () => ({
    success: true,
    data: { states: [{ id: 1, name: "Novo" }, { id: 2, name: "Autorizado" }, { id: 3, name: "Atribuído" }], priorities: [] },
  }),
}));

const { getQueueBoard, getManagerDashboard } = await import("./service");
const { clearManagerSnapshots } = await import("../../shared/manager-snapshot");

const requester = { actorId: "a1", email: "gestor@exemplo.org", zammadUser: { id: 3, role_ids: [] } } as unknown as Requester;
const NOW = "2026-11-20T12:00:00.000Z";

let nextId = 100;
function ticket(state: string, ownerId: number, groupId = 1, createdAt = NOW): ZammadExpandedTicket {
  const id = (nextId += 1);
  return {
    id,
    number: String(id),
    title: `Chamado ${id}`,
    group: groupId === 1 ? "Tecnologia" : "Marketing",
    group_id: groupId,
    state,
    state_id: 1,
    priority_id: 2,
    priority: "2 normal",
    owner_id: ownerId,
    customer_id: 9,
    created_at: createdAt,
    updated_at: createdAt,
  } as ZammadExpandedTicket;
}

const closedNames = new Set(["Finalizado"]);

function setup(unassigned: ZammadExpandedTicket[], member: ZammadExpandedTicket[]) {
  searchTicketsByOwner.mockImplementation(async (_requester: unknown, ownerId: number) => ({
    success: true,
    data: ownerId === 1 ? unassigned : member,
  }));
  searchOpenTicketsByOwner.mockImplementation(async (_requester: unknown, ownerId: number) => ({
    success: true,
    data: (ownerId === 1 ? unassigned : member).filter((item) => !closedNames.has(item.state)),
  }));
  loadTicketTags.mockImplementation(async () => new Map());
}

beforeEach(() => {
  searchTicketsByOwner.mockReset();
  searchOpenTicketsByOwner.mockReset();
  loadTicketTags.mockReset();
  clearManagerSnapshots();
  nextId = 100;
});

describe("fila do gestor — Em aberto", () => {
  it("é a aba padrão: todas as etapas abertas (Não autorizado e Concluído incluídos), Finalizado não", async () => {
    setup(
      [ticket("Novo", 1), ticket("Não autorizado", 1), ticket("Finalizado", 1)],
      [ticket("Atribuído", 5), ticket("Em andamento", 5), ticket("Concluído", 5)],
    );
    const result = await getQueueBoard(requester);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bucket).toBe("abertos");
    expect(result.data.counts).toMatchObject({ abertos: 5, novo: 1, nao_autorizado: 1, atribuido: 1, andamento: 1, concluido: 1 });
    expect(result.data.items.map((row) => row.bucket).sort()).toEqual(["andamento", "atribuido", "concluido", "nao_autorizado", "novo"]);
  });

  it("até 10 linhas por etapa, mas o total da etapa é o real", async () => {
    setup(
      Array.from({ length: 12 }, () => ticket("Novo", 1)),
      [],
    );
    const result = await getQueueBoard(requester);
    if (!result.success) throw new Error("falhou");
    expect(result.data.items).toHaveLength(10);
    expect(result.data.filteredCounts.novo).toBe(12);
    expect(result.data.counts.abertos).toBe(12);
  });

  it("sem tags (uma leitura por chamado) e sem buscar os encerrados dos agentes", async () => {
    setup([ticket("Novo", 1)], [ticket("Em andamento", 5)]);
    await getQueueBoard(requester);
    expect(loadTicketTags).not.toHaveBeenCalled();
    // sem responsável: 1 busca; do agente: só os abertos
    expect(searchTicketsByOwner).toHaveBeenCalledTimes(1);
    expect(searchOpenTicketsByOwner).toHaveBeenCalledTimes(1);
  });

  it("o filtro de setor muda as linhas e os totais das etapas, mas não os números das abas", async () => {
    setup([ticket("Novo", 1, 1), ticket("Novo", 1, 2), ticket("Novo", 1, 2)], []);
    const result = await getQueueBoard(requester, { groupId: 2 });
    if (!result.success) throw new Error("falhou");
    expect(result.data.items.every((row) => row.groupId === 2)).toBe(true);
    expect(result.data.filteredCounts.novo).toBe(2);
    expect(result.data.counts.novo).toBe(3);
    // os chips de setor continuam mostrando todos
    expect(result.data.sectors.map((sector) => sector.id).sort()).toEqual([1, 2]);
  });

  it("a ordem por prioridade vale dentro de cada etapa", async () => {
    const urgent = { ...ticket("Novo", 1), priority_id: 3, priority: "3 high" } as ZammadExpandedTicket;
    const old = ticket("Novo", 1, 1, "2026-11-01T12:00:00.000Z");
    setup([old, urgent], []);
    const result = await getQueueBoard(requester, { sort: "prioridade" });
    if (!result.success) throw new Error("falhou");
    expect(result.data.items[0].id).toBe(urgent.id);
  });
});

describe("fila do gestor — cache das leituras", () => {
  it("trocar de aba ou de filtro não volta ao Zammad", async () => {
    setup([ticket("Novo", 1, 1), ticket("Autorizado", 1, 2)], [ticket("Em andamento", 5)]);
    await getQueueBoard(requester);
    await getQueueBoard(requester, { bucket: "novo" });
    await getQueueBoard(requester, { groupId: 2, sort: "prioridade" });
    await getManagerDashboard(requester);
    expect(searchTicketsByOwner).toHaveBeenCalledTimes(1);
    expect(searchOpenTicketsByOwner).toHaveBeenCalledTimes(1);
  });

  it("uma escrita do plugin no Zammad descarta o cache", async () => {
    setup([ticket("Novo", 1)], []);
    await getQueueBoard(requester);
    const listeners = (globalThis as { __colaboraWriteListeners?: (() => void)[] }).__colaboraWriteListeners ?? [];
    expect(listeners.length).toBeGreaterThan(0);
    for (const listener of listeners) listener();
    await getQueueBoard(requester);
    expect(searchTicketsByOwner).toHaveBeenCalledTimes(2);
  });

  it("a aba Finalizado lê os encerrados dos agentes e tem cache próprio", async () => {
    setup([ticket("Novo", 1)], [ticket("Finalizado", 5)]);
    await getQueueBoard(requester);
    await getQueueBoard(requester, { bucket: "finalizado" });
    await getQueueBoard(requester, { bucket: "finalizado" });
    // abertos: 1 (sem responsável); finalizado: 2 (sem responsável + agente) — uma vez só
    expect(searchTicketsByOwner).toHaveBeenCalledTimes(3);
  });

  it("uma busca de agente que falhou não vai para o cache", async () => {
    setup([ticket("Novo", 1)], []);
    searchOpenTicketsByOwner.mockImplementation(async () => ({ success: false, error: { code: "x", message: "timeout" } }));
    await getQueueBoard(requester);
    await getQueueBoard(requester);
    expect(searchTicketsByOwner).toHaveBeenCalledTimes(2);
  });
});

describe("fila do gestor — abas de etapa", () => {
  it("uma etapa traz as linhas dela, com tags", async () => {
    setup([ticket("Novo", 1), ticket("Autorizado", 1)], []);
    const result = await getQueueBoard(requester, { bucket: "novo" });
    if (!result.success) throw new Error("falhou");
    expect(result.data.items.map((row) => row.bucket)).toEqual(["novo"]);
    expect(loadTicketTags).toHaveBeenCalledTimes(1);
    // as contagens das outras abas continuam disponíveis
    expect(result.data.counts.autorizado).toBe(1);
  });

  it("Finalizado: busca os encerrados dos agentes, sem tags, e a aba passa a ter número", async () => {
    setup([ticket("Finalizado", 1)], [ticket("Finalizado", 5), ticket("Em andamento", 5)]);
    const result = await getQueueBoard(requester, { bucket: "finalizado" });
    if (!result.success) throw new Error("falhou");
    expect(result.data.items).toHaveLength(2);
    expect(result.data.uncounted).toEqual([]);
    expect(loadTicketTags).not.toHaveBeenCalled();
    // sem responsável + do agente (com os encerrados)
    expect(searchTicketsByOwner).toHaveBeenCalledTimes(2);
  });

  it("fora de Finalizado, a aba Finalizado fica sem número", async () => {
    setup([ticket("Novo", 1)], []);
    const result = await getQueueBoard(requester);
    if (!result.success) throw new Error("falhou");
    expect(result.data.uncounted).toEqual(["finalizado"]);
  });
});

describe("Início do gestor", () => {
  it("Não autorizado espera o solicitante: não entra nos mais antigos da fila", async () => {
    setup([ticket("Novo", 1), ticket("Não autorizado", 1)], []);
    const result = await getManagerDashboard(requester);
    if (!result.success) throw new Error("falhou");
    expect(result.data.queueTop.map((row) => row.bucket)).toEqual(["novo"]);
  });
});
