import { Tag } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import { describeTags } from "../../shared/tag-labels";
import { FLOW_BADGE } from "./palette";

// Selos das tags do Zammad (só para a equipe). As do fluxo da FEM têm nome e cor semântica; as demais, neutras.
// `as="span"` para usar dentro de um link/linha que já é um item de lista.
// `stateLabel`: esconde a tag que só repete o estado (ex.: tag "nao-autorizado" num chamado em Não autorizado).
// Tags em LINHA de lista (pedido explícito do usuário, apesar de a regra de design deixá-las no detalhe): o mais
// discreto possível — texto pequeno e neutro, com uma bolinha na cor da tag, separado por " · " dos metadados.
// Só aparecem as que dizem algo além do estado.
export function TagInline({ tags, stateLabel }: { tags: readonly string[] | undefined; stateLabel?: string }) {
  const same = stateLabel?.trim().toLowerCase();
  const views = describeTags(tags ?? []).filter((tag) => tag.label.toLowerCase() !== same);
  if (views.length === 0) return null;
  return (
    <span aria-label="Tags" className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {views.map((tag) => (
        <span key={tag.name} className="inline-flex items-center gap-1 text-muted-foreground">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tag.color === "neutral" ? "bg-muted-foreground/50" : FLOW_BADGE[tag.color].dot)} />
          {tag.label}
        </span>
      ))}
    </span>
  );
}

export function TagChips({ tags, as = "ul", className, stateLabel }: { tags: readonly string[] | undefined; as?: "ul" | "span"; className?: string; stateLabel?: string }) {
  const same = stateLabel?.trim().toLowerCase();
  const views = describeTags(tags ?? []).filter((tag) => tag.label.toLowerCase() !== same);
  if (views.length === 0) return null;
  const Outer = as;
  const Item = as === "ul" ? "li" : "span";
  return (
    <Outer aria-label="Tags" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {views.map((tag) => (
        // Neutro como o selo de estado (regra de design: cor forte só no que pede ação); o ícone leva a cor.
        <Item key={tag.name} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground">
          <Tag className={cn("size-3", FLOW_BADGE[tag.color].icon)} aria-hidden />
          {tag.label}
        </Item>
      ))}
    </Outer>
  );
}
