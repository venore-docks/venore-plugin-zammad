import { describe, expect, it, vi } from "vitest";
import { SwrCache } from "./snapshot-cache";

function setup(options: { freshMs?: number; staleMs?: number; isCacheable?: (value: number) => boolean } = {}) {
  let time = 0;
  let calls = 0;
  const cache = new SwrCache<number>({ freshMs: 1000, staleMs: 10_000, now: () => time, ...options });
  const load = vi.fn(async () => ({ success: true as const, data: ++calls }));
  return { cache, load, tick: (ms: number) => (time += ms) };
}

describe("SwrCache", () => {
  it("fresco: devolve o guardado sem ler de novo", async () => {
    const { cache, load, tick } = setup();
    expect(await cache.get("a", load)).toEqual({ success: true, data: 1 });
    tick(999);
    expect(await cache.get("a", load)).toEqual({ success: true, data: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("chaves diferentes não se misturam", async () => {
    const { cache, load } = setup();
    await cache.get("a", load);
    expect(await cache.get("b", load)).toEqual({ success: true, data: 2 });
  });

  it("antigo: entrega o que tem na hora e atualiza em segundo plano", async () => {
    const { cache, load, tick } = setup();
    await cache.get("a", load);
    tick(5000);
    expect(await cache.get("a", load)).toEqual({ success: true, data: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    expect(await cache.get("a", load)).toEqual({ success: true, data: 2 });
  });

  it("vencido: espera a leitura nova", async () => {
    const { cache, load, tick } = setup();
    await cache.get("a", load);
    tick(11_000);
    expect(await cache.get("a", load)).toEqual({ success: true, data: 2 });
  });

  it("várias pessoas pedindo ao mesmo tempo compartilham UMA leitura", async () => {
    const { cache, load } = setup();
    const [first, second, third] = await Promise.all([cache.get("a", load), cache.get("a", load), cache.get("a", load)]);
    expect([first, second, third]).toEqual(Array(3).fill({ success: true, data: 1 }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falha não é guardada: a próxima leitura tenta de novo", async () => {
    const { cache } = setup();
    const failing = vi.fn(async () => ({ success: false as const, error: { code: "x", message: "fora do ar" } }));
    expect((await cache.get("a", failing)).success).toBe(false);
    expect((await cache.get("a", failing)).success).toBe(false);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("falha na atualização em segundo plano mantém o antigo", async () => {
    const { cache, load, tick } = setup();
    await cache.get("a", load);
    tick(5000);
    const failing = vi.fn(async () => ({ success: false as const, error: { code: "x", message: "fora do ar" } }));
    expect(await cache.get("a", failing)).toEqual({ success: true, data: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(await cache.get("a", load)).toEqual({ success: true, data: 1 });
  });

  it("invalidate descarta tudo: a próxima leitura é nova", async () => {
    const { cache, load } = setup();
    await cache.get("a", load);
    cache.invalidate();
    expect(await cache.get("a", load)).toEqual({ success: true, data: 2 });
  });

  it("leitura que já estava em andamento quando houve escrita não é guardada", async () => {
    const { cache } = setup();
    let release: (() => void) | undefined;
    const slow = vi.fn(
      () =>
        new Promise<{ success: true; data: number }>((resolve) => {
          release = () => resolve({ success: true, data: 99 });
        }),
    );
    const pending = cache.get("a", slow);
    cache.invalidate();
    release?.();
    await pending;
    const fresh = vi.fn(async () => ({ success: true as const, data: 5 }));
    expect(await cache.get("a", fresh)).toEqual({ success: true, data: 5 });
  });

  it("resultado não cacheável (leitura incompleta) não é guardado", async () => {
    const { cache, load } = setup({ isCacheable: (value) => value > 1 });
    await cache.get("a", load);
    expect(await cache.get("a", load)).toEqual({ success: true, data: 2 });
    expect(await cache.get("a", load)).toEqual({ success: true, data: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("freshMs 0 desliga o cache", async () => {
    const { cache, load } = setup({ freshMs: 0 });
    await cache.get("a", load);
    await cache.get("a", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
