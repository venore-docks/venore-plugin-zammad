import { describe, expect, it } from "vitest";
import { QUEUE_BUCKETS, bucketOf, bucketParam, countBuckets, defaultBucket, parseBucket, pendingDecisions } from "./queue-buckets";

describe("bucketOf", () => {
  it("etapas de decisão do gestor, com ou sem responsável", () => {
    expect(bucketOf("novo", false)).toBe("novo");
    expect(bucketOf("em_analise", true)).toBe("analise");
    expect(bucketOf("autorizado", false)).toBe("autorizado");
    expect(bucketOf("nao_autorizado", false)).toBe("nao_autorizado");
    expect(bucketOf("reavaliacao", false)).toBe("reavaliacao");
  });

  it("uma aba por estado: Atribuído, Em andamento, Concluído e Finalizado também", () => {
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

  it("as abas seguem a ordem do fluxo", () => {
    expect(QUEUE_BUCKETS.map((bucket) => bucket.key)).toEqual([
      "novo",
      "analise",
      "reavaliacao",
      "autorizado",
      "atribuido",
      "andamento",
      "concluido",
      "nao_autorizado",
      "finalizado",
    ]);
  });
});

describe("parâmetros e contagem", () => {
  it("?etapa aceita o hífen e recusa lixo", () => {
    expect(parseBucket("nao-autorizado")).toBe("nao_autorizado");
    expect(parseBucket("analise")).toBe("analise");
    expect(parseBucket("x")).toBeUndefined();
    expect(parseBucket("atribuidos")).toBe("andamento");
    expect(parseBucket("finalizado")).toBe("finalizado");
    expect(bucketParam("nao_autorizado")).toBe("nao-autorizado");
  });

  it("aba padrão = primeira com decisão pendente; contagem do menu", () => {
    const counts = countBuckets([{ bucket: "autorizado" as const }, { bucket: "reavaliacao" as const }, { bucket: "atribuido" as const }, { bucket: "finalizado" as const }]);
    expect(defaultBucket(counts)).toBe("reavaliacao");
    expect(pendingDecisions(counts)).toBe(2);
    expect(defaultBucket(countBuckets([]))).toBe("novo");
  });
});
