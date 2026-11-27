// Aviso do que o plugin fez sozinho junto de uma mudança (para o toast depois da ação). Puro.
//   paused    outros chamados Em andamento do responsável, pausados por urgência (um Em andamento por agente)
//   defaults  tempo previsto/prazo preenchidos com o padrão de 1 dia útil
export function updateNotice(outcome: { paused?: { number: string }[]; defaults?: string[] } | null | undefined): string | null {
  if (!outcome) return null;
  const parts: string[] = [];
  const paused = outcome.paused ?? [];
  if (paused.length === 1) parts.push(`O chamado #${paused[0].number}, que estava em andamento, foi pausado (urgência).`);
  if (paused.length > 1) parts.push(`Os chamados ${paused.map((ticket) => `#${ticket.number}`).join(", ")}, que estavam em andamento, foram pausados (urgência).`);
  const defaults = new Set(outcome.defaults ?? []);
  if (defaults.has("estimate") && defaults.has("deadline")) parts.push("Tempo previsto e prazo de entrega ficaram em 1 dia útil (padrão).");
  else if (defaults.has("estimate")) parts.push("Tempo previsto ficou em 1 dia útil (padrão).");
  else if (defaults.has("deadline")) parts.push("Prazo de entrega ficou em 1 dia útil (padrão).");
  return parts.length > 0 ? parts.join(" ") : null;
}
