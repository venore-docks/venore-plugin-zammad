"use client";

import { useState, useTransition } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Switch, Textarea } from "@venore/plugin-sdk/ui";
import type { GroupWizardConfig } from "../../contracts/types";
import type { AdminSector } from "../../features/admin-overview/types";
import { reloadSchemaAction, saveGroupConfigAction, saveIntroAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  select: "escolha",
  multiselect: "várias escolhas",
  boolean: "sim/não",
  date: "data",
  datetime: "data e hora",
  text: "texto curto",
  textarea: "texto longo",
  integer: "número",
};

export function ReloadSchemaButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reloadSchemaAction();
          if (result.ok) toast.success("Campos recarregados do Zammad.");
          else toast.error(result.error);
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      Recarregar do Zammad
    </Button>
  );
}

export function IntroForm({ intro }: { intro: string | null }) {
  const [value, setValue] = useState(intro ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Texto de abertura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Aparece na primeira etapa, acima da escolha do setor. Em branco, usa o texto padrão.</p>
        <Textarea rows={2} maxLength={1000} value={value} onChange={(event) => setValue(event.target.value)} />
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveIntroAction(value);
              if (result.ok) toast.success("Texto salvo.");
              else toast.error(result.error);
            })
          }
        >
          Salvar texto
        </Button>
      </CardContent>
    </Card>
  );
}

export function GroupConfigCard({ sector }: { sector: AdminSector }) {
  const [config, setConfig] = useState<GroupWizardConfig>(sector.config);
  const [pending, startTransition] = useTransition();
  const update = (patch: Partial<GroupWizardConfig>) => setConfig((prev) => ({ ...prev, ...patch }));
  const usedSteps = [...new Set(Object.values(config.fieldSteps))].sort((a, b) => a - b);

  function save() {
    startTransition(async () => {
      const result = await saveGroupConfigAction(sector.groupId, config);
      if (result.ok) toast.success(`Setor "${sector.zammadName}" salvo.`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {sector.zammadName}
            {!config.enabled && <Badge variant="outline">oculto</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Grupo #{sector.groupId} no Zammad · {sector.fields.length} {sector.fields.length === 1 ? "campo" : "campos"} ·{" "}
            {sector.steps.length + 3} etapas no total
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Switch checked={config.enabled} onCheckedChange={(enabled) => update({ enabled })} />
          Aparece na abertura de chamados
        </label>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <TextField label="Nome exibido" placeholder={sector.zammadName} value={config.label} max={80} onChange={(label) => update({ label })} />
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Ordem</span>
            <Input
              type="number"
              min={0}
              max={999}
              value={config.order ?? ""}
              placeholder="A–Z"
              onChange={(event) => update({ order: event.target.value === "" ? null : Number(event.target.value) })}
            />
          </label>
        </div>
        <TextField
          label="Descrição no cartão do setor"
          placeholder="Ex.: Consertos, elétrica, hidráulica, móveis"
          value={config.description}
          max={300}
          onChange={(description) => update({ description })}
        />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-foreground">Dicas da etapa “Conte o que você precisa”</span>
          <span className="block text-xs text-muted-foreground">Uma dica por linha. Em branco, usa as dicas padrão.</span>
          <Textarea
            rows={3}
            maxLength={1000}
            value={config.bodyHint ?? ""}
            onChange={(event) => update({ bodyHint: event.target.value })}
            placeholder={"Qual material e para qual evento?\nTem referência visual? Anexe."}
          />
        </label>

        {sector.fields.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Perguntas (do Zammad)</p>
            <p className="text-xs text-muted-foreground">
              Campos com o mesmo número de etapa aparecem juntos na mesma tela. Sem número, o portal agrupa sozinho: perguntas de escolha ficam
              sozinhas, datas vão juntas, perguntas rápidas em lotes de 3 e tudo que é opcional numa etapa só, no fim.
            </p>
            <div className="divide-y rounded-lg border">
              {sector.fields.map((field) => (
                <div key={field.name} className="grid gap-3 p-3 sm:grid-cols-[1fr_6rem]">
                  <div className="space-y-2">
                    <p className="text-sm text-foreground">
                      {field.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {TYPE_LABELS[field.type] ?? field.type}
                        {field.required ? " · obrigatório" : " · opcional"}
                      </span>
                    </p>
                    <Input
                      value={config.fieldHelp[field.name] ?? ""}
                      maxLength={500}
                      placeholder="Texto de ajuda (opcional)"
                      onChange={(event) => update({ fieldHelp: { ...config.fieldHelp, [field.name]: event.target.value } })}
                    />
                  </div>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Etapa
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={config.fieldSteps[field.name] ?? ""}
                      placeholder="auto"
                      onChange={(event) => {
                        const next = { ...config.fieldSteps };
                        if (event.target.value === "") delete next[field.name];
                        else next[field.name] = Number(event.target.value);
                        update({ fieldSteps: next });
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {usedSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Títulos das etapas numeradas</p>
            {usedSteps.map((step) => (
              <TextField
                key={step}
                label={`Etapa ${step}`}
                placeholder="Em branco: a pergunta (1 campo) ou “Mais alguns detalhes”"
                value={config.stepTitles[String(step)] ?? null}
                max={120}
                onChange={(title) => update({ stepTitles: { ...config.stepTitles, [String(step)]: title ?? "" } })}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={pending}>
            Salvar setor
          </Button>
          <Button variant="ghost" asChild>
            <a href={`/chamados/novo?setor=${sector.groupId}`} target="_blank" rel="noreferrer">
              Testar este setor
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TextField({
  label,
  placeholder,
  value,
  max,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  max: number;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <Input value={value ?? ""} maxLength={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
