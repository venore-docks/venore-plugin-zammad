import type { OperationResult } from "@venore/plugin-sdk";

// Cache em memória "serve o antigo enquanto atualiza" (stale-while-revalidate) para leituras caras do Zammad. Puro (o
// relógio é injetável): testado em snapshot-cache.test.ts.
//
//   fresco   (< freshMs)  devolve na hora, sem falar com o Zammad;
//   antigo   (< staleMs)  devolve na hora o que tem e atualiza em segundo plano (a próxima leitura já vem nova);
//   vencido ou ausente    espera a leitura (uma só, mesmo com várias pessoas pedindo ao mesmo tempo).
//
// `invalidate()` descarta tudo (usado quando o plugin escreve no Zammad: a pessoa precisa ver a própria mudança) e
// faz uma leitura que já estava em andamento NÃO ser guardada (ela pode ter começado antes da escrita).
// `freshMs <= 0` desliga o cache: toda leitura vai ao Zammad.
export type SwrCacheOptions<T> = {
  freshMs: number;
  staleMs: number;
  // Resultado que não deve ser guardado (ex.: leitura incompleta).
  isCacheable?: (value: T) => boolean;
  now?: () => number;
  maxEntries?: number;
};

export class SwrCache<T> {
  private readonly store = new Map<string, { at: number; value: T }>();
  private readonly inflight = new Map<string, Promise<OperationResult<T>>>();
  private generation = 0;

  constructor(private readonly options: SwrCacheOptions<T>) {}

  private clock(): number {
    return (this.options.now ?? Date.now)();
  }

  async get(key: string, load: () => Promise<OperationResult<T>>): Promise<OperationResult<T>> {
    if (this.options.freshMs <= 0) return load();
    const entry = this.store.get(key);
    if (entry) {
      const age = this.clock() - entry.at;
      if (age < this.options.freshMs) return { success: true, data: entry.value };
      if (age < this.options.staleMs) {
        // Em segundo plano: falha aqui mantém o antigo e a próxima leitura tenta de novo.
        void this.refresh(key, load).catch(() => undefined);
        return { success: true, data: entry.value };
      }
    }
    return this.refresh(key, load);
  }

  invalidate(): void {
    this.store.clear();
    this.inflight.clear();
    this.generation += 1;
  }

  private refresh(key: string, load: () => Promise<OperationResult<T>>): Promise<OperationResult<T>> {
    const running = this.inflight.get(key);
    if (running) return running;
    const generation = this.generation;
    const promise: Promise<OperationResult<T>> = load()
      .then((result) => {
        const cacheable = result.success && generation === this.generation && (this.options.isCacheable?.(result.data) ?? true);
        if (result.success && cacheable) {
          if (this.store.size >= (this.options.maxEntries ?? 200)) this.store.clear();
          this.store.set(key, { at: this.clock(), value: result.data });
        }
        return result;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }
}
