import { Lock } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { FlowStepKey } from "../../contracts/types";
import { FLOW_STEPS, isFinalStep } from "../../shared/flow";

// Etapas do fluxo da FEM no cabeçalho do chamado: barra fina e neutra (feito = escuro, falta = muted) com o cadeado
// no fim, que marca o único passo que ENCERRA o chamado (Finalizado). Ao lado: "Etapa N de M · em aberto" ou
// "Encerrado". O estado em si já está no selo; o nome de cada etapa aparece no `title`.
//
//   Novo → Em análise → Autorizado → Atribuído → Em andamento → Concluído → Finalizado
//   Não autorizado (o solicitante reenvia) → Reavaliação → Autorizado → …   (depois segue o caminho normal)
const MAIN: FlowStepKey[] = ["novo", "em_analise", "autorizado", "atribuido", "em_andamento", "concluido", "finalizado"];
const AFTER_DENIAL: FlowStepKey[] = ["novo", "em_analise", "nao_autorizado", "reavaliacao", "autorizado", "atribuido", "em_andamento", "concluido", "finalizado"];

function pathFor(step: FlowStepKey): FlowStepKey[] {
  return step === "nao_autorizado" || step === "reavaliacao" ? AFTER_DENIAL : MAIN;
}

export function FlowProgress({ step }: { step: FlowStepKey }) {
  const path = pathFor(step);
  const current = path.indexOf(step);
  const closed = isFinalStep(step);
  const label = closed ? "Encerrado" : `Etapa ${current + 1} de ${path.length} · em aberto`;
  return (
    <div className="flex items-center gap-3">
      <ol aria-label={`${label}: ${FLOW_STEPS[step].label}`} className="flex flex-1 gap-1">
        {path.map((key, index) => (
          <li
            key={key}
            title={FLOW_STEPS[key].label}
            aria-current={index === current ? "step" : undefined}
            className={cn("h-1 flex-1 rounded-full", index <= current ? "bg-foreground/60" : "bg-muted")}
          >
            <span className="sr-only">
              {FLOW_STEPS[key].label}
              {isFinalStep(key) ? " (encerra o chamado)" : ""}
              {index < current ? " (concluída)" : index === current ? " (atual)" : ""}
            </span>
          </li>
        ))}
      </ol>
      <Lock aria-hidden className={cn("-ms-1 size-3 shrink-0", closed ? "text-foreground" : "text-muted-foreground/60")} />
      <span aria-hidden className={cn("shrink-0 text-xs tabular-nums", closed ? "font-medium text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}
