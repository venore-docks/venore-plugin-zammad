import { describe, expect, it } from "vitest";
import { FALLBACK_CALENDAR, addBusinessSeconds, businessDaySeconds, businessSecondsBetween, toBusinessCalendar, type BusinessCalendar } from "./business-hours";
import { DEFAULT_ESTIMATE, estimateSeconds, findEstimateKey } from "./estimate";

// "Horário comercial FEM" (Zammad, 27/11/2026): seg–sex, 9h–17h, America/Sao_Paulo. 27/11/2026 é sexta-feira.
const FEM = FALLBACK_CALENDAR;
const at = (local: string) => new Date(`${local}:00-03:00`);
const hours = (value: number) => value * 3600;
const withHoliday = (date: string): BusinessCalendar => ({ ...FEM, holidays: new Set([date]) });

describe("businessSecondsBetween", () => {
  it("dentro do mesmo dia útil", () => {
    expect(businessSecondsBetween(at("2026-11-26T10:00"), at("2026-11-26T12:30"), FEM)).toBe(hours(2.5));
  });

  it("virada de dia: só conta o expediente (quinta 16h30 → sexta 9h30 = 1 h)", () => {
    expect(businessSecondsBetween(at("2026-11-26T16:30"), at("2026-11-27T09:30"), FEM)).toBe(hours(1));
  });

  it("antes da abertura e depois do fechamento não contam", () => {
    expect(businessSecondsBetween(at("2026-11-26T07:00"), at("2026-11-26T10:00"), FEM)).toBe(hours(1));
    expect(businessSecondsBetween(at("2026-11-26T16:00"), at("2026-11-26T22:00"), FEM)).toBe(hours(1));
  });

  it("fim de semana não conta (sexta 16h → segunda 10h = 2 h)", () => {
    expect(businessSecondsBetween(at("2026-11-27T16:00"), at("2026-11-30T10:00"), FEM)).toBe(hours(2));
    expect(businessSecondsBetween(at("2026-11-28T10:00"), at("2026-11-29T18:00"), FEM)).toBe(0);
  });

  it("feriado não conta (segunda 30/11 feriado: sexta 16h → terça 10h = 2 h)", () => {
    expect(businessSecondsBetween(at("2026-11-27T16:00"), at("2026-12-01T10:00"), withHoliday("2026-11-30"))).toBe(hours(2));
  });

  it("fim antes do início = 0", () => {
    expect(businessSecondsBetween(at("2026-11-26T12:00"), at("2026-11-26T10:00"), FEM)).toBe(0);
  });
});

describe("addBusinessSeconds", () => {
  it("1 dia útil (8 h) a partir de sexta 16h vence segunda 16h", () => {
    expect(addBusinessSeconds(at("2026-11-27T16:00"), businessDaySeconds(FEM), FEM).toISOString()).toBe(at("2026-11-30T16:00").toISOString());
  });

  it("começando no fim de semana, conta a partir da abertura de segunda", () => {
    expect(addBusinessSeconds(at("2026-11-28T10:00"), hours(1), FEM).toISOString()).toBe(at("2026-11-30T10:00").toISOString());
  });

  it("pula o feriado", () => {
    expect(addBusinessSeconds(at("2026-11-27T16:00"), hours(2), withHoliday("2026-11-30")).toISOString()).toBe(at("2026-12-01T10:00").toISOString());
  });

  it("terminar exatamente no fechamento vale o próprio fechamento", () => {
    expect(addBusinessSeconds(at("2026-11-26T09:00"), hours(8), FEM).toISOString()).toBe(at("2026-11-26T17:00").toISOString());
  });

  it("ida e volta: o tempo útil até o vencimento é o pedido", () => {
    const start = at("2026-11-25T14:20");
    const due = addBusinessSeconds(start, hours(13), FEM);
    expect(businessSecondsBetween(start, due, FEM)).toBe(hours(13));
  });
});

describe("calendário do Zammad", () => {
  it("lê dias, faixas e feriados ativos de GET /calendars", () => {
    const calendar = toBusinessCalendar({
      id: 1,
      name: "Horário comercial FEM",
      timezone: "America/Sao_Paulo",
      default: true,
      business_hours: {
        mon: { active: true, timeframes: [["09:00", "12:00"], ["13:00", "17:00"]] },
        sat: { active: false, timeframes: [["09:00", "17:00"]] },
      },
      public_holidays: { "2026-12-25": { active: true, summary: "Natal" }, "2026-12-24": { active: false } },
    });
    expect(businessDaySeconds(calendar)).toBe(hours(7));
    expect([...calendar.holidays]).toEqual(["2026-12-25"]);
    // Segunda 30/11, 11h → 14h: 1 h de manhã + 1 h à tarde (almoço não conta).
    expect(businessSecondsBetween(at("2026-11-30T11:00"), at("2026-11-30T14:00"), calendar)).toBe(hours(2));
  });

  it("1 dia útil do calendário da FEM = 8 h", () => {
    expect(businessDaySeconds(FEM)).toBe(hours(8));
  });
});

describe("tempo previsto em segundos úteis", () => {
  const day = hours(8);
  it("horas e minutos são horas úteis; dias, jornadas; semana, 5 dias úteis", () => {
    expect(estimateSeconds("30m", day)).toBe(1800);
    expect(estimateSeconds("4h", day)).toBe(hours(4));
    expect(estimateSeconds("1d", day)).toBe(day);
    expect(estimateSeconds("3d ", day)).toBe(3 * day);
    expect(estimateSeconds("2sem", day)).toBe(10 * day);
    expect(estimateSeconds("outro", day)).toBeNull();
  });

  it("o padrão 1 dia usa a chave exata do Zammad", () => {
    const options = [
      { value: "1h", label: "1 hora" },
      { value: "1d", label: "1 dia" },
      { value: "3d ", label: "3 dias" },
    ];
    expect(findEstimateKey(options, DEFAULT_ESTIMATE)).toBe("1d");
    expect(findEstimateKey(options, "3d")).toBe("3d ");
    expect(findEstimateKey(options, "9d")).toBeNull();
  });
});
