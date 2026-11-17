import { Check } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { FlowStepKey } from "../../contracts/types";
import { FLOW_STEPS } from "../../shared/flow";
import { FLOW_BADGE } from "./palette";

// Linha do tempo do fluxo da FEM no cabeçalho do chamado: passos feitos, o atual (na cor dele) e os que
// faltam. Caminho muda nos desvios (não autorizado; reavaliação).
const MAIN: FlowStepKey[] = ["novo", "em_analise", "autorizado", "em_andamento", "concluido", "finalizado"];

function pathFor(step: FlowStepKey): FlowStepKey[] {
  if (step === "nao_autorizado") return ["novo", "em_analise", "nao_autorizado"];
  if (step === "reavaliacao") return ["novo", "reavaliacao", "autorizado", "em_andamento", "concluido", "finalizado"];
  return MAIN;
}

export function FlowProgress({ step }: { step: FlowStepKey }) {
  const path = pathFor(step);
  const current = path.indexOf(step);
  return (
    <ol aria-label="Etapas do chamado" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {path.map((key, index) => {
        const info = FLOW_STEPS[key];
        const done = index < current;
        const active = index === current;
        const tone = FLOW_BADGE[info.color];
        return (
          <li key={key} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
            {index > 0 && <span aria-hidden className={cn("h-px w-3 sm:w-5", done || active ? "bg-foreground/40" : "bg-border")} />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                active ? cn("font-semibold text-foreground", tone.badge) : done ? "border-border text-foreground/80" : "border-dashed border-border text-muted-foreground",
              )}
            >
              {done && <Check aria-hidden className="size-3 text-success" />}
              {active && <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />}
              {info.label}
              {done && <span className="sr-only"> (concluída)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
