import type { TicketStateTone } from "../contracts/types";
import type { ZammadTicketPriority, ZammadTicketState } from "../contracts/zammad";
import { LOCAL_UTC_OFFSET } from "./answers";
import { describeState } from "./ticket-state";

// Opções que o agente escolhe no app (estado e prioridade), montadas a partir do que o Zammad tem.
// Puro: testado em ticket-options.test.ts.

export type StateOption = { id: number; name: string; label: string; tone: TicketStateTone; needsPending: boolean };
export type PriorityOption = { id: number; name: string; label: string };

const TONE_ORDER: Record<TicketStateTone, number> = { new: 0, open: 1, pending: 2, closed: 3 };

// "pending reminder" e "pending close" exigem uma data (pending_time); os demais, não.
export function isPendingState(name: string): boolean {
  return name.toLowerCase().startsWith("pending");
}

export function buildStateOptions(states: ZammadTicketState[]): StateOption[] {
  return states
    .filter((state) => state.active && state.name.toLowerCase() !== "merged")
    .map((state) => {
      const described = describeState(state.name);
      return { id: state.id, name: state.name, label: described.label, tone: described.tone, needsPending: isPendingState(state.name) };
    })
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.id - b.id);
}

// "2 normal" → "Normal"; "4 urgente" → "Urgente".
export function priorityLabel(name: string): string {
  const text = name.replace(/^\d+\s*/, "").trim() || name;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildPriorityOptions(priorities: ZammadTicketPriority[]): PriorityOption[] {
  return priorities
    .filter((priority) => priority.active)
    .sort((a, b) => a.id - b.id)
    .map((priority) => ({ id: priority.id, name: priority.name, label: priorityLabel(priority.name) }));
}

// `datetime-local` ("YYYY-MM-DDTHH:mm", sem fuso) → ISO com o fuso fixo do plugin.
export function pendingTimeToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const iso = `${local}:00${LOCAL_UTC_OFFSET}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

export function validatePending(option: StateOption, pendingTime: string | null | undefined, now: Date = new Date()): string | null {
  if (!option.needsPending) return null;
  if (!pendingTime) return `Para “${option.label}”, informe até quando.`;
  const iso = pendingTimeToIso(pendingTime);
  if (!iso) return "Data e hora inválidas.";
  if (new Date(iso).getTime() <= now.getTime()) return "A data precisa ser no futuro.";
  return null;
}
