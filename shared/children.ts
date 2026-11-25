import type { ZammadGroup } from "../contracts/zammad";

// Chamados filhos (vínculo pai/filho do Zammad). Puro: testado em children.test.ts.
//
//   subtarefa      no MESMO setor do pai: nasce Autorizado e com responsável (o gatilho "Administrador atribui
//                  agente" leva a Em andamento). Gestor escolhe o agente; agente cria para si mesmo.
//   outro setor    no grupo escolhido: nasce Novo e entra na fila do gestor de lá (análise normal).
// O solicitante do filho é QUEM O CRIOU (o filho é interno da equipe; o solicitante do pai só acompanha o pai).
// O pai não pode ser concluído com filho aberto (aberto = estado não fechado).

export type ChildMode = "subtask" | "sector";

export function isChildMode(value: unknown): value is ChildMode {
  return value === "subtask" || value === "sector";
}

// Setores para "pedir a outro setor": grupos ativos e FOLHA (setor com subgrupos não recebe chamado direto: o
// filho vai para o assunto, como na abertura), com o nome completo legível ("Recursos Humanos › Benefícios"),
// exceto o próprio grupo do pai (para o mesmo setor existe a subtarefa).
export function childGroupOptions(groups: readonly ZammadGroup[], parentGroupId: number): { id: number; label: string }[] {
  const parents = new Set(groups.filter((group) => group.active && group.parent_id !== null).map((group) => group.parent_id));
  return groups
    .filter((group) => group.active && group.id !== parentGroupId && !parents.has(group.id))
    .map((group) => ({ id: group.id, label: group.name.split("::").map((part) => part.trim()).join(" › ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

// Quantos filhos ainda estão abertos (bloqueiam a conclusão do pai).
export function openChildren(children: readonly { closed: boolean }[]): number {
  return children.filter((child) => !child.closed).length;
}

export function childrenBlockMessage(open: number): string {
  return open === 1
    ? "Falta 1 chamado filho ser finalizado antes de concluir este."
    : `Faltam ${open} chamados filhos serem finalizados antes de concluir este.`;
}

// Primeira linha do corpo do filho: de onde ele veio (texto, vira HTML escapado no serviço).
export function childOrigin(parent: { number: string; title: string }): string {
  return `Chamado filho de #${parent.number} — ${parent.title}`;
}
