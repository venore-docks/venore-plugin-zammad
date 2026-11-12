import { describe, expect, it } from "vitest";
import {
  ageMs,
  ageTone,
  formatAge,
  hrefWith,
  isUrgentPriority,
  loadLevel,
  maxOpen,
  parseQueueSort,
  parseSectorFilter,
  percentOf,
  pickLeastLoaded,
  rankLoads,
  sectorChips,
  shortGroupName,
  sortQueue,
  summarizeManager,
} from "./manager-stats";

const NOW = new Date("2026-11-12T12:00:00Z").getTime();
const H = 3600 * 1000;

describe("prioridade urgente", () => {
  it("reconhece os nomes do Zammad e da FEM", () => {
    expect(isUrgentPriority("3 high")).toBe(true);
    expect(isUrgentPriority("4 urgente")).toBe(true);
    expect(isUrgentPriority("2 normal")).toBe(false);
    expect(isUrgentPriority("1 low")).toBe(false);
    expect(isUrgentPriority(undefined)).toBe(false);
  });
});

describe("idade", () => {
  it("formata curto", () => {
    expect(formatAge(10 * 60 * 1000)).toBe("menos de 1 h");
    expect(formatAge(5 * H)).toBe("5 h");
    expect(formatAge(50 * H)).toBe("2 d");
  });

  it("tom por faixa e data inválida vira 0", () => {
    expect(ageTone(2 * H)).toBe("fresh");
    expect(ageTone(30 * H)).toBe("aging");
    expect(ageTone(80 * H)).toBe("stale");
    expect(ageMs("lixo", NOW)).toBe(0);
    expect(ageMs("2026-11-12T10:00:00Z", NOW)).toBe(2 * H);
  });
});

describe("carga por agente", () => {
  const loads = [
    { id: 1, name: "Ana", open: 12, waiting: 3 },
    { id: 2, name: "Bia", open: 4, waiting: 0 },
    { id: 3, name: "Caio", open: 0, waiting: 0 },
    { id: 4, name: "Davi", open: 2, waiting: 1 },
  ];

  it("ordena do mais carregado ao mais livre e marca os extremos", () => {
    const ranked = rankLoads(loads);
    expect(ranked.map((row) => row.name)).toEqual(["Ana", "Bia", "Davi", "Caio"]);
    expect(ranked.map((row) => row.level)).toEqual(["heavy", "normal", "normal", "idle"]);
  });

  it("equipe de uma pessoa só nunca é 'livre' nem 'sobrecarregada'", () => {
    expect(loadLevel(0, [{ open: 0 }])).toBe("normal");
    expect(loadLevel(20, [{ open: 20 }])).toBe("normal");
  });

  it("muitos abertos mas perto da média não é sobrecarga", () => {
    expect(loadLevel(7, [{ open: 7 }, { open: 7 }, { open: 6 }])).toBe("normal");
  });

  it("escala de barras", () => {
    expect(maxOpen(loads)).toBe(12);
    expect(maxOpen([])).toBe(1);
    expect(percentOf(6, 12)).toBe(50);
    expect(percentOf(0, 12)).toBe(0);
    expect(percentOf(30, 12)).toBe(100);
  });

  it("sugere o menos carregado; empate desempata por aguardando", () => {
    expect(pickLeastLoaded(loads)?.name).toBe("Caio");
    expect(pickLeastLoaded([{ id: 1, open: 2, waiting: 2 }, { id: 2, open: 2, waiting: 0 }])?.id).toBe(2);
    expect(pickLeastLoaded([])).toBeNull();
  });
});

describe("KPIs do gestor", () => {
  it("conta fila, atendimento, aguardando e urgentes", () => {
    const kpis = summarizeManager(
      [
        { ownerId: 1, priority: "3 high", customerWaiting: false, createdAt: "2026-11-12T06:00:00Z" },
        { ownerId: 1, priority: "2 normal", customerWaiting: false, createdAt: "2026-11-10T12:00:00Z" },
      ],
      [
        { ownerId: 5, priority: "2 normal", customerWaiting: true, createdAt: "2026-11-11T12:00:00Z" },
        { ownerId: 6, priority: "4 urgente", customerWaiting: false, createdAt: "2026-11-11T12:00:00Z" },
        { ownerId: 6, priority: "2 normal", customerWaiting: true, createdAt: "2026-11-11T12:00:00Z" },
      ],
      NOW,
    );
    expect(kpis).toEqual({ queue: 2, queueOldestMs: 48 * H, inService: 3, awaitingSupport: 2, urgent: 2 });
  });

  it("fila vazia não tem idade", () => {
    expect(summarizeManager([], [], NOW)).toEqual({ queue: 0, queueOldestMs: null, inService: 0, awaitingSupport: 0, urgent: 0 });
  });
});

describe("ordenação e filtro da fila", () => {
  const items = [
    { id: 1, ageMs: 2 * H, priorityId: 3 },
    { id: 2, ageMs: 9 * H, priorityId: 2 },
    { id: 3, ageMs: 5 * H, priorityId: 3 },
  ];

  it("por idade: o mais antigo primeiro", () => {
    expect(sortQueue(items, "idade").map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("por prioridade: mais urgente primeiro, e dentro dela o mais antigo", () => {
    expect(sortQueue(items, "prioridade").map((item) => item.id)).toEqual([3, 1, 2]);
  });

  it("não altera a lista original", () => {
    sortQueue(items, "prioridade");
    expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("normaliza parâmetros da URL", () => {
    expect(parseQueueSort("prioridade")).toBe("prioridade");
    expect(parseQueueSort("x")).toBe("idade");
    expect(parseQueueSort(undefined)).toBe("idade");
    expect(parseSectorFilter("6")).toBe(6);
    expect(parseSectorFilter("0")).toBeUndefined();
    expect(parseSectorFilter("6; drop")).toBeUndefined();
    expect(parseSectorFilter(undefined)).toBeUndefined();
  });

  it("chips de setor contam e ordenam", () => {
    const chips = sectorChips([
      { groupId: 6, group: "Marketing" },
      { groupId: 1, group: "Manutenção" },
      { groupId: 6, group: "Marketing" },
    ]);
    expect(chips).toEqual([
      { id: 6, name: "Marketing", count: 2 },
      { id: 1, name: "Manutenção", count: 1 },
    ]);
  });

  it("nome curto do grupo e link com parâmetros", () => {
    expect(shortGroupName("Tecnologia::Suporte")).toBe("Suporte");
    expect(shortGroupName("Marketing")).toBe("Marketing");
    expect(hrefWith("/colabora/fila", { setor: 6, ordem: undefined })).toBe("/colabora/fila?setor=6");
    expect(hrefWith("/colabora/fila", {})).toBe("/colabora/fila");
  });
});
