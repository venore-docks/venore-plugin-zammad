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

// Cores SEMÂNTICAS do fluxo (estado e botões de decisão). Só tokens: success/warning (com -soft/-border),
// destructive (perigo; sem -soft no vocabulário, por isso /10 e /40), primary e chart-2 (informação).
// Cada tema (Aurora inclusive) e a paleta personalizada do editor de temas redefinem esses tokens.
export type FlowTone = "neutral" | "info" | "primary" | "warning" | "success" | "danger";

// `border`: faixa lateral do card (border-s-4) na cor do estado.
export const FLOW_BADGE: Record<FlowTone, { badge: string; dot: string; bar: string; soft: string; icon: string; border: string }> = {
  neutral: { badge: "border-border bg-muted", dot: "bg-muted-foreground/50", bar: "bg-border", soft: "border-border bg-muted", icon: "text-muted-foreground", border: "border-s-border" },
  info: { badge: "border-chart-2/40 bg-chart-2/10", dot: "bg-chart-2", bar: "bg-chart-2", soft: "border-chart-2/40 bg-chart-2/10", icon: "text-chart-2", border: "border-s-chart-2" },
  primary: { badge: "border-primary/40 bg-primary/10", dot: "bg-primary", bar: "bg-primary", soft: "border-primary/40 bg-primary/10", icon: "text-primary", border: "border-s-primary" },
  warning: { badge: "border-warning-border bg-warning-soft", dot: "bg-warning", bar: "bg-warning", soft: "border-warning-border bg-warning-soft", icon: "text-warning", border: "border-s-warning" },
  success: { badge: "border-success-border bg-success-soft", dot: "bg-success", bar: "bg-success", soft: "border-success-border bg-success-soft", icon: "text-success", border: "border-s-success" },
  danger: { badge: "border-destructive/40 bg-destructive/10", dot: "bg-destructive", bar: "bg-destructive", soft: "border-destructive/40 bg-destructive/10", icon: "text-destructive", border: "border-s-destructive" },
};

// Botão de decisão: cheio, na cor semântica, para chamar a atenção (o texto usa o *-foreground do
// mesmo token, que cada tema calibra para contraste). Informação/neutro usam primary/contorno.
export const FLOW_BUTTON: Record<FlowTone, string> = {
  neutral: "border border-border bg-card text-foreground hover:bg-muted",
  info: "bg-primary text-primary-foreground hover:bg-primary/90",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

// Versão COMPACTA (cards de lista): o fundo na cor semântica com um pouco de transparência (cheio no hover) —
// pequeno e menos pesado que o botão de painel, para o título e os dados do chamado continuarem em destaque.
export const FLOW_BUTTON_SUBTLE: Record<FlowTone, string> = {
  neutral: "bg-muted/80 text-foreground hover:bg-muted",
  info: "bg-primary/75 text-primary-foreground hover:bg-primary",
  primary: "bg-primary/75 text-primary-foreground hover:bg-primary",
  warning: "bg-warning/75 text-warning-foreground hover:bg-warning",
  success: "bg-success/75 text-success-foreground hover:bg-success",
  danger: "bg-destructive/75 text-destructive-foreground hover:bg-destructive",
};

// Tamanho do botão compacto: 20 px, texto 11 px, cantos quase retos e sem ícone (o texto já diz a ação).
export const FLOW_BUTTON_SMALL = "h-5 gap-0 rounded-sm px-1.5 py-0 text-[0.6875rem] leading-none font-medium shadow-none has-[>svg]:px-1.5 [&_svg]:hidden";

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
