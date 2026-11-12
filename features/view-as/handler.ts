import { searchUsers } from "@venore/plugin-sdk/auth";
import { failure } from "../../shared/results";
import { canViewAs, findViewAsTarget, readViewAs, startViewAs, stopViewAs } from "../../shared/view-as";
import type { GetViewAsStatusResult, SearchViewAsTargetsResult, StartViewAsResult, StopViewAsResult, ViewAsPerson } from "./types";

const NOT_ALLOWED = "Só quem administra o Colabora pode usar o “ver como”.";

export async function getViewAsStatusHandler(): Promise<GetViewAsStatusResult> {
  const admin = await canViewAs();
  if (!admin.allowed || !admin.actorId) return { success: true, data: { canViewAs: false, target: null } };
  return { success: true, data: { canViewAs: true, target: await readViewAs(admin.actorId) } };
}

// Busca no portal (nome ou e-mail), só contas aprovadas, sem a própria.
export async function searchViewAsTargetsHandler(query: string): Promise<SearchViewAsTargetsResult> {
  const admin = await canViewAs();
  if (!admin.allowed) return failure("forbidden", NOT_ALLOWED);
  const search = query.trim().slice(0, 80);
  if (search.length < 2) return { success: true, data: [] };

  const found = await searchUsers({ search, status: "approved", limit: 8 });
  if (!found.success) return found;
  const people = await Promise.all(
    found.data.entries.filter((entry) => entry.id !== admin.actorId).map((entry) => findViewAsTarget(entry.id)),
  );
  return { success: true, data: people.filter((person): person is ViewAsPerson => person !== null) };
}

export async function startViewAsHandler(targetId: string): Promise<StartViewAsResult> {
  const admin = await canViewAs();
  if (!admin.allowed || !admin.actorId) return failure("forbidden", NOT_ALLOWED);
  if (targetId === admin.actorId) return failure("self", "Escolha outra pessoa: você já vê o Colabora como você.");
  const target = await findViewAsTarget(targetId);
  if (!target) return failure("not_found", "Pessoa não encontrada (ou conta não aprovada no portal).");
  await startViewAs(admin.actorId, target.id);
  console.info(`[colabora] ver como: ${admin.actorId} → ${target.id}`);
  return { success: true, data: target };
}

// Sair não exige ser admin: qualquer um pode apagar o próprio cookie.
export async function stopViewAsHandler(): Promise<StopViewAsResult> {
  await stopViewAs();
  return { success: true, data: null };
}
