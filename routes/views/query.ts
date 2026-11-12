// Parâmetros de consulta (?filtro=…&setor=…) das telas de lista, já normalizados: o Next entrega
// `string | string[] | undefined`; aqui vira sempre o primeiro valor (ou undefined). Cada tela lê só as chaves
// que conhece (ex.: Atribuídos → `filtro`, Equipe → `setor`) e ignora o resto.
export type ViewQuery = Record<string, string | undefined>;

export function normalizeQuery(raw: Record<string, string | string[] | undefined>): ViewQuery {
  const query: ViewQuery = {};
  for (const [key, value] of Object.entries(raw)) query[key] = Array.isArray(value) ? value[0] : value;
  return query;
}
