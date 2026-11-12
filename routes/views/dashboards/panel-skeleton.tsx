// Placeholder enquanto um painel do dashboard busca dados no Zammad (a primeira carga fria pode levar alguns
// segundos). Mantém a altura aproximada do painel para a página não "pular" quando ele chega.
export function PanelSkeleton({ label, kpis = 4, rows = 3 }: { label: string; kpis?: number; rows?: number }) {
  return (
    <section className="space-y-6 rounded-xl border bg-card p-4 sm:p-6" aria-label={label} aria-busy="true">
      <div className="space-y-2">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      </div>
      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: kpis }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/50" />
          ))}
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </section>
  );
}
