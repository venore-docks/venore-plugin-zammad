import Link from "next/link";
import type { LinkedTicket, TicketDetail } from "../../contracts/types";
import { surfaceFor, type SurfaceKey } from "../../shared/routes";
import { StateBadge } from "../public/shared";
import { ChildTicketDialog } from "./child-ticket-dialog";

// Chamados filhos na visão da equipe: a lista (estado e responsável de cada um) e o "Criar chamado filho".
// Regra de design: lista padrão `divide-y` com um nível de borda; o botão é contorno (ação secundária).
export function ChildTickets({ ticket, surfaceKey }: { ticket: TicketDetail; surfaceKey: SurfaceKey }) {
  const agent = ticket.agent;
  if (!agent) return null;
  if (ticket.children.length === 0 && !agent.canCreateChild) return null;
  const surface = surfaceFor(surfaceKey);
  const open = ticket.openChildren;

  return (
    <section aria-label="Chamados filhos" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Chamados filhos
          {ticket.children.length > 0 && (
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {open > 0 ? `${open} de ${ticket.children.length} em aberto` : "todos finalizados"}
            </span>
          )}
        </h3>
        {agent.canCreateChild && (
          <ChildTicketDialog parentId={ticket.id} isSupervisor={agent.canAllocate} assignees={agent.assignees} groups={agent.childGroups} />
        )}
      </div>
      {ticket.children.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {ticket.children.map((child) => (
            <ChildRow key={child.id} child={child} href={surface.detail(child.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChildRow({ child, href }: { child: LinkedTicket; href: string }) {
  const meta = [child.group, child.ownerName ? `com ${child.ownerName}` : "sem responsável"].join(" · ");
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{child.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        </span>
        <StateBadge label={child.stateLabel} tone={child.stateTone} color={child.stateColor} />
      </Link>
    </li>
  );
}

// "Faz parte de #N título" no chamado filho.
export function ParentLink({ parent, surfaceKey }: { parent: LinkedTicket; surfaceKey: SurfaceKey }) {
  return (
    <p className="text-sm text-muted-foreground">
      Faz parte de{" "}
      <Link href={surfaceFor(surfaceKey).detail(parent.id)} className="font-medium text-foreground hover:underline">
        #{parent.number} · {parent.title}
      </Link>
    </p>
  );
}
