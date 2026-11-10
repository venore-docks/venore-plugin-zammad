import Link from "next/link";
import { Badge, Button, cn } from "@venore/plugin-sdk/ui";
import type { TicketStateTone } from "../../contracts/types";

const TONE_CLASSES: Record<TicketStateTone, string> = {
  new: "border-primary/30 bg-primary/10 text-primary",
  open: "border-primary/30 bg-primary/10 text-primary",
  pending: "border-border bg-muted text-muted-foreground",
  closed: "border-border bg-transparent text-muted-foreground",
};

export function StateBadge({ label, tone }: { label: string; tone: TicketStateTone }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASSES[tone])}>
      {label}
    </Badge>
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

// Mensagem de bloqueio (sem permissão, conta inexistente no Zammad, integração desligada).
export function BlockedNotice({ title, message, showBack = false }: { title: string; message: string; showBack?: boolean }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      {showBack && (
        <Button variant="outline" asChild>
          <Link href="/chamados">Voltar para meus chamados</Link>
        </Button>
      )}
    </div>
  );
}
