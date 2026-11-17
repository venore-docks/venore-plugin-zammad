import { Tag } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import { describeTags } from "../../shared/tag-labels";
import { FLOW_BADGE } from "./palette";

// Selos das tags do Zammad (só para a equipe). As do fluxo da FEM têm nome e cor semântica; as demais, neutras.
// `as="span"` para usar dentro de um link/linha que já é um item de lista.
export function TagChips({ tags, as = "ul", className }: { tags: readonly string[] | undefined; as?: "ul" | "span"; className?: string }) {
  const views = describeTags(tags ?? []);
  if (views.length === 0) return null;
  const Outer = as;
  const Item = as === "ul" ? "li" : "span";
  return (
    <Outer aria-label="Tags" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {views.map((tag) => (
        <Item
          key={tag.name}
          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-foreground", FLOW_BADGE[tag.color].badge)}
        >
          <Tag className={cn("size-3", FLOW_BADGE[tag.color].icon)} aria-hidden />
          {tag.label}
        </Item>
      ))}
    </Outer>
  );
}
