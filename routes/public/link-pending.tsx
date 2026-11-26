"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";

// Sinal de "carregando" DENTRO de um <Link>: aparece enquanto a navegação daquele link está em andamento. As telas
// do Colabora são renderizadas no servidor e dependem do Zammad (segundos); sem isto, o clique numa aba ou filtro
// parecia não fazer nada e a pessoa clicava de novo. Vai como filho do <Link> (exigência do useLinkStatus).
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      <span className="sr-only">Carregando…</span>
    </span>
  );
}
