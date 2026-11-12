import type { PeopleGroup, SectorAudience, WizardConfig } from "../contracts/types";

// Audiência dos setores: quem enxerga cada setor na abertura de chamados. Puro (sem servidor).
//
//   all      todos os colaboradores
//   groups   só membros de algum dos grupos de pessoas listados (lista vazia = ninguém, exceto admin)
//   inherit  usa a audiência do setor pai; setor raiz com "inherit" = todos
//
// Quem administra o plugin (`colabora.settings.manage`) vê todos os setores: serve de prévia.

export const DEFAULT_AUDIENCE: SectorAudience = { mode: "inherit", groupIds: [] };

export type AudienceSector = { groupId: number; parentId: number | null };
export type AudienceViewer = { isAdmin: boolean; groupIds: readonly string[] };
export type ResolvedAudience = {
  mode: "all" | "groups";
  groupIds: string[];
  // Setor de onde a regra veio (o próprio, ou o ancestral herdado); null = padrão (todos).
  sourceSectorId: number | null;
};

export function audienceOf(config: WizardConfig, groupId: number): SectorAudience {
  return config.groups[String(groupId)]?.audience ?? DEFAULT_AUDIENCE;
}

// Resolve a herança pai → filho. Ciclo ou pai desconhecido caem em "todos".
export function resolveAudience(groupId: number, sectors: readonly AudienceSector[], config: WizardConfig): ResolvedAudience {
  const parents = new Map(sectors.map((sector) => [sector.groupId, sector.parentId]));
  const seen = new Set<number>();
  let current: number | null = groupId;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const audience = audienceOf(config, current);
    if (audience.mode === "all") return { mode: "all", groupIds: [], sourceSectorId: current };
    if (audience.mode === "groups") return { mode: "groups", groupIds: audience.groupIds, sourceSectorId: current };
    current = parents.get(current) ?? null;
  }
  return { mode: "all", groupIds: [], sourceSectorId: null };
}

export function isSectorVisible(groupId: number, sectors: readonly AudienceSector[], config: WizardConfig, viewer: AudienceViewer): boolean {
  if (viewer.isAdmin) return true;
  const audience = resolveAudience(groupId, sectors, config);
  if (audience.mode === "all") return true;
  return audience.groupIds.some((id) => viewer.groupIds.includes(id));
}

// Ids dos grupos de pessoas em que o usuário está.
export function groupIdsOfUser(groups: readonly PeopleGroup[], userId: string): string[] {
  return groups.filter((group) => group.memberIds.includes(userId)).map((group) => group.id);
}

export type AudienceBadge = { kind: "all" | "groups" | "hidden"; label: string; inherited: boolean };

// Texto do selo do setor: "Todos", "Só: TI, RH" ou "Oculto" (restrito sem nenhum grupo existente).
export function audienceBadge(
  groupId: number,
  sectors: readonly AudienceSector[],
  config: WizardConfig,
  groups: readonly Pick<PeopleGroup, "id" | "name">[],
): AudienceBadge {
  const resolved = resolveAudience(groupId, sectors, config);
  const inherited = resolved.sourceSectorId !== null && resolved.sourceSectorId !== groupId;
  if (resolved.mode === "all") return { kind: "all", label: "Todos", inherited };
  const names = resolved.groupIds.map((id) => groups.find((group) => group.id === id)?.name).filter((name): name is string => Boolean(name));
  if (names.length === 0) return { kind: "hidden", label: "Oculto", inherited };
  return { kind: "groups", label: `Só: ${names.join(", ")}`, inherited };
}
