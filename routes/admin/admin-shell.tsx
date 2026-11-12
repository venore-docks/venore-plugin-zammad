import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader, Button } from "@venore/plugin-sdk/ui";
import { AdminNav } from "./admin-nav";

// Moldura de todas as subrotas do admin: cabeçalho do plugin + navegação por seções + o conteúdo.
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Colabora"
        description="A central de chamados da FEM: o que cada pessoa vê, quem pode abrir cada fluxo e como o app aparece no celular."
        actions={
          <Button variant="outline" asChild>
            <Link href="/colabora" target="_blank">
              <ExternalLink className="size-4" />
              Abrir o Colabora
            </Link>
          </Button>
        }
      />
      <AdminNav />
      {children}
    </div>
  );
}

// Cabeçalho de cada seção (abaixo das abas).
export function SectionHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Toda página do admin começa por aqui: sem permissão, mostra o aviso padrão do core.
export async function guardAdmin(): Promise<ReactNode | null> {
  const gate = await getPluginAdminPageData("colabora");
  if (gate.granted) return null;
  return <AdminAccessDenied message="Você não tem permissão para administrar o Colabora." />;
}

export function LoadError({ message }: { message: string }) {
  return (
    <AdminShell>
      <p className="text-sm text-destructive">Erro ao carregar: {message}</p>
    </AdminShell>
  );
}
