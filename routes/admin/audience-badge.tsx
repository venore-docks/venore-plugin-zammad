import { Eye, EyeOff, Users } from "lucide-react";
import { Badge } from "@venore/plugin-sdk/ui";
import type { AudienceBadge as AudienceBadgeData } from "../../shared/audience";

// Selo de quem enxerga o setor: "Todos", "Só: TI, RH" ou "Oculto".
export function AudienceBadge({ audience }: { audience: AudienceBadgeData }) {
  const variant = audience.kind === "hidden" ? "destructive" : audience.kind === "groups" ? "default" : "outline";
  return (
    <Badge variant={variant} className="max-w-full" title={audience.inherited ? `${audience.label} (herdado do setor pai)` : audience.label}>
      {audience.kind === "all" ? <Eye aria-hidden /> : audience.kind === "groups" ? <Users aria-hidden /> : <EyeOff aria-hidden />}
      <span className="truncate">{audience.label}</span>
      {audience.inherited && <span className="font-normal opacity-80">· herdado</span>}
    </Badge>
  );
}
