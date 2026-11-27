// Horas úteis pelo calendário do Zammad ("Horário comercial FEM": dias, faixas de horário, feriados e fuso).
// Puro e sem dependência de servidor: testado em business-hours.test.ts. O carregador fica em calendar.ts.
//
//   businessSecondsBetween(início, fim)   quanto tempo útil passou entre dois instantes
//   addBusinessSeconds(início, segundos)  quando vence um prazo de N segundos úteis
//   businessDaySeconds()                  quanto vale "1 dia útil" (a jornada de um dia útil do calendário)
//
// Os horários do calendário são do relógio local do fuso do calendário (America/Sao_Paulo). O deslocamento de cada
// dia vem de `Intl`, então horário de verão (se voltar) também fica certo.

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BusinessCalendar = {
  timezone: string;
  // Por dia da semana: ativo e faixas "HH:MM"–"HH:MM" (fim exclusivo; "24:00" vale o fim do dia).
  businessHours: Partial<Record<Weekday, { active: boolean; timeframes: [string, string][] }>>;
  // Datas "YYYY-MM-DD" (no fuso do calendário) sem expediente.
  holidays: ReadonlySet<string>;
};

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_MS = 24 * 60 * 60 * 1000;
// Limite de dias percorridos (evita laço infinito num calendário sem nenhum dia útil).
const MAX_DAYS = 3660;

// Calendário de reserva quando o Zammad não responde: o mesmo "Horário comercial FEM" (seg–sex, 9h–17h).
export const FALLBACK_CALENDAR: BusinessCalendar = {
  timezone: "America/Sao_Paulo",
  businessHours: Object.fromEntries(
    (["mon", "tue", "wed", "thu", "fri"] as Weekday[]).map((day) => [day, { active: true, timeframes: [["09:00", "17:00"]] as [string, string][] }]),
  ),
  holidays: new Set(),
};

// Formato cru de GET /api/v1/calendars.
export type ZammadCalendar = {
  id: number;
  name: string;
  timezone: string;
  default?: boolean;
  business_hours: Record<string, { active?: boolean; timeframes?: [string, string][] }>;
  public_holidays?: Record<string, { active?: boolean; summary?: string } | null> | null;
};

export function toBusinessCalendar(raw: ZammadCalendar, extraHolidays: readonly string[] = []): BusinessCalendar {
  const businessHours: BusinessCalendar["businessHours"] = {};
  for (const day of WEEKDAYS) {
    const config = raw.business_hours?.[day];
    if (config) businessHours[day] = { active: config.active === true, timeframes: (config.timeframes ?? []).filter((frame) => frame.length === 2) };
  }
  const holidays = new Set(extraHolidays);
  for (const [date, info] of Object.entries(raw.public_holidays ?? {})) {
    if (info?.active !== false) holidays.add(date);
  }
  return { timezone: raw.timezone || "America/Sao_Paulo", businessHours, holidays };
}

// Deslocamento do fuso (em minutos, local − UTC) num instante.
function offsetMinutes(timezone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

// Data local "YYYY-MM-DD" de um instante no fuso.
export function localDate(timezone: string, instant: number): string {
  const shifted = new Date(instant + offsetMinutes(timezone, instant) * 60000);
  return shifted.toISOString().slice(0, 10);
}

// Instante (ms UTC) de "data local + HH:MM" no fuso.
function localToInstant(timezone: string, date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes);
  // Duas passadas: o deslocamento certo é o do instante resultante (vale perto da troca de horário).
  const first = naive - offsetMinutes(timezone, naive) * 60000;
  return naive - offsetMinutes(timezone, first) * 60000;
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + DAY_MS).toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

// Janelas de expediente (ms UTC) de uma data local, já sem feriados.
function windowsOf(calendar: BusinessCalendar, date: string): [number, number][] {
  if (calendar.holidays.has(date)) return [];
  const config = calendar.businessHours[weekdayOf(date)];
  if (!config?.active) return [];
  return config.timeframes
    .map(([from, to]): [number, number] => [localToInstant(calendar.timezone, date, from), localToInstant(calendar.timezone, date, to)])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
}

// Segundos úteis entre dois instantes (0 se o fim não passa do início).
export function businessSecondsBetween(start: Date, end: Date, calendar: BusinessCalendar): number {
  const from = start.getTime();
  const to = end.getTime();
  if (!(to > from)) return 0;
  let total = 0;
  let date = localDate(calendar.timezone, from);
  const last = localDate(calendar.timezone, to);
  for (let guard = 0; guard < MAX_DAYS; guard += 1) {
    for (const [open, close] of windowsOf(calendar, date)) {
      const overlap = Math.min(close, to) - Math.max(open, from);
      if (overlap > 0) total += overlap;
    }
    if (date >= last) break;
    date = nextDate(date);
  }
  return Math.round(total / 1000);
}

// Instante em que se completam `seconds` segundos úteis a partir de `start`. Começando fora do expediente, conta
// a partir da próxima abertura. 0 segundos = o próprio início.
export function addBusinessSeconds(start: Date, seconds: number, calendar: BusinessCalendar): Date {
  let remaining = Math.max(0, seconds) * 1000;
  const from = start.getTime();
  if (remaining === 0) return new Date(from);
  let date = localDate(calendar.timezone, from);
  for (let guard = 0; guard < MAX_DAYS; guard += 1) {
    for (const [open, close] of windowsOf(calendar, date)) {
      const begin = Math.max(open, from);
      if (close <= begin) continue;
      const available = close - begin;
      if (remaining <= available) return new Date(begin + remaining);
      remaining -= available;
    }
    date = nextDate(date);
  }
  throw new Error("calendario sem dias uteis");
}

// "1 dia útil" = a jornada do primeiro dia ativo da semana (seg–sex 9h–17h = 8 h).
export function businessDaySeconds(calendar: BusinessCalendar): number {
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as Weekday[]) {
    const config = calendar.businessHours[day];
    if (!config?.active) continue;
    const minutes = config.timeframes.reduce((sum, [from, to]) => sum + (toMinutes(to) - toMinutes(from)), 0);
    if (minutes > 0) return minutes * 60;
  }
  return 8 * 60 * 60;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
