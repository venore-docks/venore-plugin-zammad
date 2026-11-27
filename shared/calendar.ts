import "server-only";
import { FALLBACK_CALENDAR, toBusinessCalendar, type BusinessCalendar, type ZammadCalendar } from "./business-hours";
import { zammadRequest } from "./zammad-client";

// Calendário de atendimento = o calendário PADRÃO do Zammad (GET /calendars; na FEM, "Horário comercial FEM").
// Muda raramente: cache de 1 h por processo. Sem resposta do Zammad (ou sem permissão admin.calendar no token),
// vale o calendário de reserva (seg–sex 9h–17h) e o log avisa uma vez. Feriados do plugin Calendários entram na
// etapa das horas úteis (fonte opcional).
const TTL_MS = 60 * 60 * 1000;
let cached: { at: number; calendar: BusinessCalendar } | null = null;
let warned = false;

export async function loadBusinessCalendar(): Promise<BusinessCalendar> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.calendar;
  const result = await zammadRequest<ZammadCalendar[]>("calendars");
  const list = result.success && Array.isArray(result.data) ? result.data : [];
  const raw = list.find((calendar) => calendar.default) ?? list[0];
  if (!raw) {
    if (!warned) {
      console.warn("[colabora] calendario do Zammad indisponivel; usando seg-sex 9h-17h");
      warned = true;
    }
    return FALLBACK_CALENDAR;
  }
  const calendar = toBusinessCalendar(raw);
  cached = { at: Date.now(), calendar };
  return calendar;
}
