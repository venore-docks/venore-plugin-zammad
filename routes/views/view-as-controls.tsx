"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogOut, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, Input, cn } from "@venore/plugin-sdk/ui";
import type { ViewAsPerson } from "../../index";
import { searchViewAsAction, startViewAsAction, stopViewAsAction } from "../public/actions";

// Faixa do "ver como" (enquanto ligado) e o seletor de pessoa (só para admin do Colabora).
export function ViewAsControls({ target, canPick, homeHref }: { target: ViewAsPerson | null; canPick: boolean; homeHref: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function stop() {
    startTransition(async () => {
      await stopViewAsAction();
      toast.success("Você voltou a ver o Colabora como você.");
      router.push(homeHref);
      router.refresh();
    });
  }

  if (target) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-foreground"
      >
        <p className="flex min-w-0 items-center gap-2">
          <Eye className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            Vendo como <strong className="font-semibold">{target.name ?? target.email}</strong>
            <span className="text-muted-foreground"> · {target.email} · só leitura</span>
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {canPick && <ViewAsPicker label="Trocar" homeHref={homeHref} />}
          <Button size="sm" variant="outline" className="bg-background" disabled={busy} onClick={stop}>
            <LogOut className="size-4" />
            Sair do ver como
          </Button>
        </div>
      </div>
    );
  }

  if (!canPick) return null;
  return (
    <div className="flex justify-end">
      <ViewAsPicker label="Ver como…" homeHref={homeHref} />
    </div>
  );
}

function ViewAsPicker({ label, homeHref }: { label: string; homeHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Resultado guardado junto com o termo buscado: só vale enquanto o campo ainda mostra esse termo.
  const [found, setFound] = useState<{ term: string; people: ViewAsPerson[]; error: string | null } | null>(null);
  const [searching, startSearch] = useTransition();
  const [starting, startStart] = useTransition();
  const term = query.trim();
  const current = found && found.term === term && term.length >= 2 ? found : null;
  const people = current?.people ?? [];
  const error = current?.error ?? null;
  const searched = current !== null;

  // Busca com espera curta enquanto digita.
  useEffect(() => {
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchViewAsAction(term);
        setFound(result.ok ? { term, people: result.data, error: null } : { term, people: [], error: result.error });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  function pick(person: ViewAsPerson) {
    startStart(async () => {
      const result = await startViewAsAction(person.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Vendo como ${result.data.name ?? result.data.email}.`);
      router.push(homeHref);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="bg-background">
          <Eye className="size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ver o Colabora como outra pessoa</DialogTitle>
          <DialogDescription>
            Você vê exatamente o que ela vê: setores liberados, chamados e o papel no atendimento. É só leitura — nada é aberto,
            respondido ou alterado em nome dela. Vale por até 2 horas.
          </DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <span className="sr-only">Buscar pessoa por nome ou e-mail</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input autoFocus className="h-11 ps-9" placeholder="Nome ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="min-h-24" aria-live="polite">
          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : searching && people.length === 0 ? (
            <p className="text-sm text-muted-foreground">Buscando…</p>
          ) : people.length > 0 ? (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => pick(person)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
                      <UserRound className="size-4 text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{person.name ?? person.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                    </span>
                    {!person.hasAccess && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">sem acesso</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : searched ? (
            <p className="text-sm text-muted-foreground">Ninguém encontrado com “{query.trim()}”.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Digite pelo menos 2 letras.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
