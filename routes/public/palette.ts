import { createElement, type ReactElement } from "react";
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  HandCoins,
  Lightbulb,
  LifeBuoy,
  Megaphone,
  Monitor,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// Cores do fluxo de chamados. Só TOKENS do tema (chart-N, success, warning, primary) — nenhuma cor
// fixa; cada tema redefine a paleta. As classes precisam estar escritas por extenso para o Tailwind
// enxergá-las, por isso a tabela é repetitiva de propósito.
export type Accent = {
  /** Fundo suave (ícone do setor, destaques). */
  soft: string;
  /** Contorno do cartão do setor. */
  border: string;
  /** Faixa de cima do cartão de pergunta. */
  top: string;
  /** Barra de progresso e bolinha. */
  solid: string;
  /** Sombra de anel do cartão selecionado. */
  ring: string;
};

export const ACCENTS: Accent[] = [
  { soft: "bg-chart-1/15", border: "border-chart-1/50", top: "border-t-chart-1", solid: "bg-chart-1", ring: "ring-chart-1/60" },
  { soft: "bg-chart-2/15", border: "border-chart-2/50", top: "border-t-chart-2", solid: "bg-chart-2", ring: "ring-chart-2/60" },
  { soft: "bg-chart-6/15", border: "border-chart-6/50", top: "border-t-chart-6", solid: "bg-chart-6", ring: "ring-chart-6/60" },
  { soft: "bg-chart-7/15", border: "border-chart-7/50", top: "border-t-chart-7", solid: "bg-chart-7", ring: "ring-chart-7/60" },
  { soft: "bg-success/15", border: "border-success/50", top: "border-t-success", solid: "bg-success", ring: "ring-success/60" },
  { soft: "bg-warning/15", border: "border-warning/50", top: "border-t-warning", solid: "bg-warning", ring: "ring-warning/60" },
];

// Cor estável por setor (não muda se a ordem da lista mudar). Subgrupos herdam a cor do pai.
export function accentFor(rootGroupId: number): Accent {
  return ACCENTS[Math.abs(rootGroupId) % ACCENTS.length];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/market|comunic|divulg/, Megaphone],
  [/tecnolog|\bti\b|inform|sistema|suporte/, Monitor],
  [/sugest|ideia/, Lightbulb],
  [/manuten|obra|reparo/, Wrench],
  [/zelad|limpez/, Sparkles],
  [/inspet|segur|portaria/, ShieldCheck],
  [/evento|cobertura|projec|som\b/, CalendarDays],
  [/tutor|pedag|ensino|aluno/, GraduationCap],
  [/recursos humanos|\brh\b|pessoas|folha/, Users],
  [/invest|financ|compra|orcament/, HandCoins],
  [/ocorrenc|registro/, ClipboardList],
];

// Função de renderização (não devolve componente): o ícone depende do NOME do setor, e criar um
// componente em variável durante o render zera o estado dele a cada passada.
export function sectorIcon(label: string, className: string): ReactElement {
  const text = normalize(label);
  const icon = ICON_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? LifeBuoy;
  return createElement(icon, { className });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
