"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Switch, Textarea, cn } from "@venore/plugin-sdk/ui";
import type { AudienceMode, GroupWizardConfig } from "../../contracts/types";
import type { AdminSector } from "../../features/admin-overview/types";
import { AudienceBadge } from "./audience-badge";
import { saveGroupConfigAction } from "./actions";

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

export type PeopleGroupOption = { id: string; name: string; memberCount: number };

type Props = {
  sector: AdminSector;
  parentName: string | null;
  peopleGroups: PeopleGroupOption[];
};

// Em setor raiz, "herdar" não tem de onde herdar: vale "todos".
function normalizeMode(mode: AudienceMode, hasParent: boolean): AudienceMode {
  return mode === "inherit" && !hasParent ? "all" : mode;
}

export function SectorEditor({ sector, parentName, peopleGroups }: Props) {
  const router = useRouter();
  const hasParent = sector.parentId !== null;
  const initial = useMemo<GroupWizardConfig>(
    () => ({ ...sector.config, audience: { ...sector.config.audience, mode: normalizeMode(sector.config.audience.mode, hasParent) } }),
    [sector.config, hasParent],
  );
  const [saved, setSaved] = useState(initial);
  const [config, setConfig] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(saved) !== JSON.stringify(config);
  const name = config.label || sector.zammadName;
  const update = (patch: Partial<GroupWizardConfig>) => setConfig((previous) => ({ ...previous, ...patch }));
  const usedSteps = [...new Set(Object.values(config.fieldSteps))].sort((a, b) => a - b);

  // Avisa ao fechar/recarregar a aba com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function save() {
    startTransition(async () => {
      const result = await saveGroupConfigAction(sector.groupId, config);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(config);
      toast.success(`Setor “${name}” salvo.`);
      router.refresh();
    });
  }

  function setMode(mode: AudienceMode) {
    update({ audience: { ...config.audience, mode } });
  }

  function toggleGroup(groupId: string) {
    const current = config.audience.groupIds;
    update({ audience: { ...config.audience, groupIds: current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId] } });
  }

  const modes: { mode: AudienceMode; title: string; description: string }[] = [
    { mode: "all", title: "Todos", description: "Qualquer colaborador pode abrir chamados neste setor." },
    { mode: "groups", title: "Apenas grupos", description: "Só quem está nos grupos de pessoas escolhidos." },
    ...(hasParent ? [{ mode: "inherit" as const, title: "Herdar do setor pai", description: parentName ? `Segue a regra de “${parentName}”.` : "Segue a regra do setor pai." }] : []),
  ];
  const selectedGroups = config.audience.groupIds.filter((id) => peopleGroups.some((group) => group.id === id));

  return (
    <div className="space-y-6 pb-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base break-words">Aparência do setor</CardTitle>
            <p className="text-xs text-muted-foreground">Grupo do Zammad: {sector.zammadName}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={config.enabled} onCheckedChange={(enabled) => update({ enabled })} />
            Aparece na abertura de chamados
          </label>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Nome exibido" help="Em branco, usa o nome do grupo no Zammad.">
              <Input value={config.label ?? ""} maxLength={80} placeholder={sector.zammadName} onChange={(event) => update({ label: event.target.value })} />
            </Field>
            <Field label="Ordem" help="Menor vem antes.">
              <Input
                type="number"
                min={0}
                max={999}
                value={config.order ?? ""}
                placeholder="A–Z"
                onChange={(event) => update({ order: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Descrição no cartão do setor" help="Uma frase curta que ajuda a pessoa a escolher o setor certo.">
            <Input
              value={config.description ?? ""}
              maxLength={300}
              placeholder="Ex.: Consertos, elétrica, hidráulica, móveis"
              onChange={(event) => update({ description: event.target.value })}
            />
          </Field>
          <Field label="Dicas da etapa “Conte o que você precisa”" help="Uma dica por linha. Em branco, usa as dicas padrão.">
            <Textarea
              rows={3}
              maxLength={1000}
              value={config.bodyHint ?? ""}
              onChange={(event) => update({ bodyHint: event.target.value })}
              placeholder={"Qual material e para qual evento?\nTem referência visual? Anexe."}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Quem vê este setor</CardTitle>
            <p className="text-xs text-muted-foreground">Todos são colaboradores, mas nem todos precisam abrir chamados em todos os setores.</p>
          </div>
          <AudienceBadge audience={sector.audience} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label="Quem vê este setor" className={cn("grid gap-2", hasParent ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {modes.map((option) => {
              const active = config.audience.mode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(option.mode)}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{option.title}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </button>
              );
            })}
          </div>

          {config.audience.mode === "groups" && (
            <div className="space-y-3">
              {peopleGroups.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Você ainda não criou grupos de pessoas.{" "}
                  <Link href="/admin/colabora/grupos" className="font-medium text-primary underline-offset-4 hover:underline">
                    Criar o primeiro grupo
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Grupos liberados</p>
                  <div className="flex flex-wrap gap-2">
                    {peopleGroups.map((group) => {
                      const on = config.audience.groupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleGroup(group.id)}
                          className={cn(
                            "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted/40",
                          )}
                        >
                          <span className="truncate">{group.name}</span>
                          <span className={cn("text-xs", on ? "opacity-80" : "text-muted-foreground")}>{group.memberCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedGroups.length === 0 && (
                <p className="flex items-start gap-2 text-sm text-warning">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Nenhum grupo escolhido: ninguém verá este setor (só administradores, como prévia).
                </p>
              )}
            </div>
          )}
          {config.audience.mode === "inherit" && (
            <p className="text-sm text-muted-foreground">Hoje, com a regra herdada, o setor aparece como “{sector.audience.label}”.</p>
          )}
          <p className="text-xs text-muted-foreground">Administradores do Colabora sempre veem todos os setores, para poder testar.</p>
        </CardContent>
      </Card>

      {sector.fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perguntas (do Zammad)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Campos com o mesmo número de etapa aparecem juntos na mesma tela. Sem número, o portal agrupa sozinho: perguntas de escolha ficam sozinhas, datas vão juntas, perguntas rápidas em
              lotes de 3 e tudo que é opcional numa etapa só, no fim.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {sector.fields.map((field) => (
                <li key={field.name} className="grid gap-3 p-3 sm:grid-cols-[1fr_6rem]">
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm text-foreground">
                      <span className="break-words">{field.label}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {TYPE_LABELS[field.type] ?? field.type} · {field.required ? "obrigatório" : "opcional"}
                      </span>
                    </p>
                    <Input
                      value={config.fieldHelp[field.name] ?? ""}
                      maxLength={500}
                      aria-label={`Texto de ajuda de “${field.label}”`}
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
                </li>
              ))}
            </ul>

            {usedSteps.length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-medium text-foreground">Títulos das etapas numeradas</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {usedSteps.map((step) => (
                    <Field key={step} label={`Etapa ${step}`}>
                      <Input
                        value={config.stepTitles[String(step)] ?? ""}
                        maxLength={120}
                        placeholder="Em branco: a pergunta (1 campo) ou “Mais alguns detalhes”"
                        onChange={(event) => update({ stepTitles: { ...config.stepTitles, [String(step)]: event.target.value } })}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 backdrop-blur">
        <p className={cn("text-sm", dirty ? "font-medium text-warning" : "text-muted-foreground")} aria-live="polite">
          {dirty ? "Há alterações não salvas." : "Tudo salvo."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" asChild>
            <a href={`/colabora/novo?setor=${sector.groupId}`} target="_blank" rel="noreferrer">
              Testar este setor
              <ExternalLink aria-hidden />
            </a>
          </Button>
          <Button onClick={save} disabled={pending || !dirty}>
            <Save aria-hidden />
            {pending ? "Salvando…" : "Salvar setor"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {help && <span className="block text-xs text-muted-foreground">{help}</span>}
      {children}
    </label>
  );
}
