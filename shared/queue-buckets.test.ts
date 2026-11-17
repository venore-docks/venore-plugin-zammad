import { describe, expect, it } from "vitest";
import { bucketOf, bucketParam, countBuckets, defaultBucket, parseBucket, pendingDecisions } from "./queue-buckets";

describe("bucketOf", () => {
  it("etapas de decisão do gestor, com ou sem responsável", () => {
    expect(bucketOf("novo", false)).toBe("novo");
    expect(bucketOf("em_analise", true)).toBe("analise");
    expect(bucketOf("autorizado", false)).toBe("autorizado");
    expect(bucketOf("nao_autorizado", false)).toBe("nao_autorizado");
    expect(bucketOf("reavaliacao", false)).toBe("reavaliacao");
  });

  it("com agente vai para Atribuídos; Finalizado sai da fila", () => {
    expect(bucketOf("em_andamento", true)).toBe("atribuidos");
    expect(bucketOf("concluido", true)).toBe("atribuidos");
    expect(bucketOf("finalizado", true)).toBeNull();
  });

  it("fora do fluxo: sem responsável é Novo, com responsável é Atribuídos", () => {
    expect(bucketOf(null, false)).toBe("novo");
    expect(bucketOf(null, true)).toBe("atribuidos");
  });
});

describe("parâmetros e contagem", () => {
  it("?etapa aceita o hífen e recusa lixo", () => {
    expect(parseBucket("nao-autorizado")).toBe("nao_autorizado");
    expect(parseBucket("analise")).toBe("analise");
    expect(parseBucket("x")).toBeUndefined();
    expect(bucketParam("nao_autorizado")).toBe("nao-autorizado");
  });

  it("aba padrão = primeira com decisão pendente; contagem do menu", () => {
    const counts = countBuckets([{ bucket: "autorizado" as const }, { bucket: "reavaliacao" as const }, { bucket: "atribuidos" as const }]);
    expect(defaultBucket(counts)).toBe("reavaliacao");
    expect(pendingDecisions(counts)).toBe(2);
    expect(defaultBucket(countBuckets([]))).toBe("novo");
  });
});
