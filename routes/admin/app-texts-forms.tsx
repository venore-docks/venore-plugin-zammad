"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@venore/plugin-sdk/ui";
import { saveAppNameAction, saveIntroAction } from "./actions";

// Avisa ao fechar a aba com alterações não salvas.
function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

export function AppNameForm({ appName }: { appName: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(appName ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== (appName ?? "");
  useUnsavedWarning(dirty);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAppNameAction(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Nome do app salvo.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nome do app</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Nome no celular</span>
            <span className="block text-xs text-muted-foreground">Aparece sob o ícone e na tela de instalação. Em branco, usa “Chamados · nome do site”. Até 30 letras.</span>
            <Input value={value} maxLength={30} placeholder="Colabora FEM" onChange={(event) => setValue(event.target.value)} className="sm:max-w-sm" />
          </label>
          <p className="text-xs text-muted-foreground">Quem já instalou o app pode precisar reinstalar para ver o novo nome.</p>
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Salvando…" : "Salvar nome"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function IntroForm({ intro }: { intro: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(intro ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== (intro ?? "");
  useUnsavedWarning(dirty);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveIntroAction(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Texto salvo.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Texto de abertura do assistente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Mensagem</span>
            <span className="block text-xs text-muted-foreground">Aparece na primeira etapa, acima da escolha do setor. Em branco, usa o texto padrão.</span>
            <Textarea rows={3} maxLength={1000} value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? "Salvando…" : "Salvar texto"}
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">{value.length}/1000</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
