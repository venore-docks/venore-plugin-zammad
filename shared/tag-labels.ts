import type { TicketStateColor } from "../contracts/types";

// Como cada tag do Zammad aparece no portal. As tags do fluxo da FEM (postas pelos gatilhos) ganham nome legível
// e cor semântica; as demais aparecem como estão, em cor neutra. Puro: testado em tag-labels.test.ts.
const KNOWN: Record<string, { label: string; color: TicketStateColor }> = {
  ajustes: { label: "Ajustes", color: "warning" },
  "nao-resolvido": { label: "Não resolvido", color: "warning" },
  rejeitado: { label: "Rejeitado", color: "danger" },
  "nao-autorizado": { label: "Não autorizado", color: "danger" },
  reenviado: { label: "Reenviado", color: "primary" },
};

export type TagView = { name: string; label: string; color: TicketStateColor };

export function describeTag(name: string): TagView {
  const key = name.trim().toLowerCase();
  const known = KNOWN[key];
  return known ? { name, ...known } : { name, label: name.trim(), color: "neutral" };
}

// Ordem de exibição: as do fluxo primeiro (as que pedem atenção), depois as outras em ordem alfabética.
export function describeTags(names: readonly string[]): TagView[] {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const views = unique.map(describeTag);
  const rank = (view: TagView) => (view.color === "danger" ? 0 : view.color === "warning" ? 1 : view.color === "primary" ? 2 : 3);
  return views.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, "pt-BR"));
}
