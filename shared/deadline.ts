import { LOCAL_UTC_OFFSET, localNow } from "./answers";
import { addBusinessSeconds, businessDaySeconds, type BusinessCalendar } from "./business-hours";

// Prazo de entrega (`prazo_entrega`, data e hora no Zammad): compromisso do setor, definido pelo administrador do
// setor, visível a todos. NUNCA se move sozinho: pausa não o altera. Quando o administrador não o definiu ao
// atribuir/iniciar (a regra 810 do Zammad o exige), vale o padrão de 1 dia útil a partir de agora (27/11/2026).
// Puro: testado em deadline.test.ts.
export const DEADLINE_FIELD = "prazo_entrega";

// "YYYY-MM-DDTHH:mm" (datetime-local, UTC-3) → ISO com fuso, como o Zammad grava.
export function deadlineToZammad(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const instant = new Date(`${local}:00${LOCAL_UTC_OFFSET}`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

// Valor do Zammad → "YYYY-MM-DDTHH:mm" em UTC-3 (para o campo datetime-local). null = sem prazo.
export function deadlineToLocal(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : localNow(instant);
}

export function defaultDeadline(now: Date, calendar: BusinessCalendar): string {
  return addBusinessSeconds(now, businessDaySeconds(calendar), calendar).toISOString();
}
