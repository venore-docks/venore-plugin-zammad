// Formatação compartilhada de textos que aparecem em várias telas. Puro: testado em format.test.ts.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Tempo decorrido, SEMPRE na mesma forma (idade do chamado, "esperando há…", "mais antigo há…"):
// "agora há pouco", "há 12 min", "há 3 h", "há 7 d".
export function elapsedLabel(ms: number): string {
  const diff = Math.max(0, ms);
  if (diff < MINUTE_MS) return "agora há pouco";
  if (diff < HOUR_MS) return `há ${Math.floor(diff / MINUTE_MS)} min`;
  if (diff < DAY_MS) return `há ${Math.floor(diff / HOUR_MS)} h`;
  return `há ${Math.floor(diff / DAY_MS)} d`;
}

export function elapsedSince(iso: string, now: Date = new Date()): string {
  const time = Date.parse(iso);
  return elapsedLabel(Number.isNaN(time) ? 0 : now.getTime() - time);
}

// O Zammad guarda o setor como "Pai::Filho"; a pessoa vê "Pai > Filho", sempre assim (nunca o separador cru).
export function formatGroupName(name: string): string {
  return name
    .split("::")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" > ");
}

// "1 - Baixa", "2 Normal", "3. Alta" → "Baixa", "Normal", "Alta" (o número é só a ordem no Zammad).
export function stripLeadingNumber(label: string): string {
  const text = label.replace(/^\d+\s*[-–—.)]?\s*/, "").trim();
  return text || label;
}

// Só tira o número quando TODAS as opções o têm (uma lista que mistura não é uma lista numerada).
export function stripNumbersFromOptions<T extends { label: string }>(options: readonly T[]): T[] {
  const numbered = options.length > 0 && options.every((option) => /^\d+\s*[-–—.)]?\s+\S/.test(option.label));
  return numbered ? options.map((option) => ({ ...option, label: stripLeadingNumber(option.label) })) : [...options];
}
