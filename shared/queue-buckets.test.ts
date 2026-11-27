import { describe, expect, it } from "vitest";
import { OPEN_STAGES, QUEUE_BUCKETS, STAGES, bucketOf, bucketParam, countBuckets, parseBucket, pendingDecisions } from "./queue-buckets";

describe("bucketOf", () => {
  it("cada estado do fluxo tem a sua etapa, com ou sem responsável", () => {
    expect(bucketOf("novo", false)).toBe("novo");
    expect(bucketOf("em_analise", true)).toBe("analise");
    expect(bucketOf("autorizado", false)).toBe("autorizado");
    expect(bucketOf("nao_autorizado", false)).toBe("nao_autorizado");
    expect(bucketOf("reavaliacao", false)).toBe("reavaliacao");
    expect(bucketOf("atribuido", true)).toBe("atribuido");
    expect(bucketOf("em_andamento", true)).toBe("andamento");
    expect(bucketOf("concluido", true)).toBe("concluido");
    expect(bucketOf("finalizado", true, true)).toBe("finalizado");
    expect(bucketOf("finalizado", false, true)).toBe("finalizado");
  });

  it("fora do fluxo: aberto sem responsável é Novo, com responsável é Em andamento, encerrado sai", () => {
    expect(bucketOf(null, false)).toBe("novo");
    expect(bucketOf(null, true)).toBe("andamento");
    expect(bucketOf(null, true, true)).toBeNull();
  });
});

describe("abas e etapas", () => {
  it("a primeira aba é Em aberto; as outras seguem o fluxo", () => {
    expect(QUEUE_BUCKETS.map((bucket) => bucket.key)).toEqual([
      "abertos",
      "novo",
      "analise",
      "autorizado",
      "nao_autorizado",
      "reavaliacao",
      "atribuido",
      "andamento",
      "pausa",
      "concluido",
      "finalizado",
    ]);
  });

  it("só Finalizado fica fora de Em aberto; as etapas abertas seguem o fluxo", () => {
    expect(STAGES.filter((stage) => !stage.open).map((stage) => stage.key)).toEqual(["finalizado"]);
    expect(OPEN_STAGES.map((stage) => stage.key)).toEqual([
      "novo",
      "analise",
      "autorizado",
      "nao_autorizado",
      "reavaliacao",
      "atribuido",
      "andamento",
      "pausa",
      "concluido",
    ]);
  });

  it("toda aba de etapa tem uma etapa com cor, e na mesma ordem", () => {
    expect(STAGES.map((stage) => stage.key)).toEqual(QUEUE_BUCKETS.filter((bucket) => bucket.key !== "abertos").map((bucket) => bucket.key));
    expect(STAGES.every((stage) => stage.color)).toBe(true);
  });
});

describe("parâmetros e contagem", () => {
  it("?etapa aceita o hífen e o endereço antigo, e recusa lixo", () => {
    expect(parseBucket("nao-autorizado")).toBe("nao_autorizado");
    expect(parseBucket("analise")).toBe("analise");
    expect(parseBucket("abertos")).toBe("abertos");
    expect(parseBucket("atribuidos")).toBe("andamento");
    expect(parseBucket("finalizado")).toBe("finalizado");
    expect(parseBucket("x")).toBeUndefined();
    expect(parseBucket(undefined)).toBeUndefined();
    expect(bucketParam("nao_autorizado")).toBe("nao-autorizado");
  });

  it("Em aberto soma tudo menos Finalizado (Não autorizado e Concluído contam)", () => {
    const counts = countBuckets([
      { bucket: "novo" as const },
      { bucket: "nao_autorizado" as const },
      { bucket: "concluido" as const },
      { bucket: "atribuido" as const },
      { bucket: "finalizado" as const },
      { bucket: "finalizado" as const },
    ]);
    expect(counts.abertos).toBe(4);
    expect(counts.finalizado).toBe(2);
    expect(countBuckets([]).abertos).toBe(0);
  });

  it("o número do menu Fila é só o que pede decisão do gestor", () => {
    const counts = countBuckets([
      { bucket: "autorizado" as const },
      { bucket: "reavaliacao" as const },
      { bucket: "atribuido" as const },
      { bucket: "nao_autorizado" as const },
      { bucket: "finalizado" as const },
    ]);
    expect(pendingDecisions(counts)).toBe(2);
  });
});
