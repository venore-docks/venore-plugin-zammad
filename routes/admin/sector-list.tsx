"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownRight, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Switch } from "@venore/plugin-sdk/ui";
import type { AdminSector } from "../../features/admin-overview/types";
import { saveGroupConfigAction } from "./actions";
import { AudienceBadge } from "./audience-badge";

export function SectorList({ sectors }: { sectors: AdminSector[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {sectors.map((sector) => (
        <li key={sector.groupId} className="min-w-0">
          <SectorCard sector={sector} />
        </li>
      ))}
    </ul>
  );
}

function SectorCard({ sector }: { sector: AdminSector }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(sector.config.enabled);
  const [pending, startTransition] = useTransition();
  const name = sector.config.label || sector.zammadName;
  const questions = sector.fields.length;

  function toggle(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await saveGroupConfigAction(sector.groupId, { ...sector.config, enabled: next });
      if (!result.ok) {
        setEnabled(previous);
        toast.error(result.error);
        return;
      }
      toast.success(next ? `“${name}” voltou a aparecer na abertura de chamados.` : `“${name}” ficou oculto na abertura de chamados.`);
      router.refresh();
    });
  }

  return (
    <Card className={enabled ? undefined : "opacity-80"}>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-base leading-snug font-medium break-words text-foreground">{name}</h3>
            {sector.parentId !== null && (
              <Badge variant="secondary" className="shrink-0">
                <CornerDownRight aria-hidden />
                Subsetor
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground" title={sector.zammadName}>
            Grupo do Zammad: {sector.zammadName}
          </p>
          <p className="text-xs text-muted-foreground">
            {questions === 0 ? "Sem perguntas" : `${questions} ${questions === 1 ? "pergunta" : "perguntas"}`}
            {questions > 0 && ` · ${sector.stepCount} ${sector.stepCount === 1 ? "etapa" : "etapas"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AudienceBadge audience={sector.audience} />
          {!enabled && <Badge variant="outline">Desativado</Badge>}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={enabled} disabled={pending} onCheckedChange={toggle} aria-label={`Mostrar “${name}” na abertura de chamados`} />
            <span>{enabled ? "Visível" : "Oculto"}</span>
          </label>
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/colabora/novo?setor=${sector.groupId}`} target="_blank" rel="noreferrer">
                Testar
                <ExternalLink aria-hidden />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/colabora/setores/${sector.groupId}`}>
                <Pencil aria-hidden />
                Editar
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
