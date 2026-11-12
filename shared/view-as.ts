import "server-only";
import { cookies } from "next/headers";
import { searchUsers } from "@venore/plugin-sdk/auth";
import { authorizeActor, getUserContext } from "@venore/plugin-sdk/rbac";
import { COLABORA_PERMISSIONS } from "./permissions";
import { signViewAs, VIEW_AS_TTL_SECONDS, verifyViewAs } from "./view-as-token";

// "Ver como" (impersonação SÓ LEITURA): quem administra o Colabora (`colabora.settings.manage`) vê as telas
// exatamente como outro usuário as vê — setores liberados, chamados, papel no atendimento — para testar e
// planejar. Nada é gravado em nome do outro: toda escrita é recusada enquanto o modo está ligado
// (ver resolveRequester). O cookie é assinado, vale 2 h e só para a sessão do admin que o criou; a permissão
// de admin é conferida de novo a cada request.

const COOKIE = "colabora_view_as";

function secret(): string | null {
  return process.env.COLABORA_VIEW_AS_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export type ViewAsTarget = { id: string; name: string | null; email: string; hasAccess: boolean };

export async function canViewAs(): Promise<{ allowed: boolean; actorId: string | null }> {
  const authz = await authorizeActor(COLABORA_PERMISSIONS.settingsManage);
  return authz.authorized ? { allowed: secret() !== null, actorId: authz.actorId } : { allowed: false, actorId: null };
}

async function hasColaboraAccess(userId: string): Promise<boolean> {
  const context = await getUserContext({ userId });
  if (!context.success) return false;
  return context.data.isSuperadmin || COLABORA_PERMISSIONS.tickets.some((key) => context.data.permissions.includes(key));
}

export async function findViewAsTarget(userId: string): Promise<ViewAsTarget | null> {
  const found = await searchUsers({ id: userId, limit: 1 });
  const user = found.success ? found.data.entries.find((entry) => entry.id === userId) : undefined;
  if (!user || user.status !== "approved") return null;
  return { id: user.id, name: user.name, email: user.email, hasAccess: await hasColaboraAccess(user.id) };
}

// Quem o admin está vendo agora (null = modo desligado, token inválido ou quem pede não é mais admin).
export async function readViewAs(actorId: string): Promise<ViewAsTarget | null> {
  const key = secret();
  if (!key) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = verifyViewAs(token, key, actorId, Math.floor(Date.now() / 1000));
  if (!payload) return null;
  const admin = await canViewAs();
  if (!admin.allowed || admin.actorId !== actorId) return null;
  return findViewAsTarget(payload.target);
}

// Só em Server Action (cookies().set não funciona durante a renderização).
export async function startViewAs(actorId: string, targetId: string): Promise<void> {
  const key = secret();
  if (!key) throw new Error("view-as sem segredo");
  (await cookies()).set(COOKIE, signViewAs({ by: actorId, target: targetId, exp: Math.floor(Date.now() / 1000) + VIEW_AS_TTL_SECONDS }, key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_AS_TTL_SECONDS,
  });
}

export async function stopViewAs(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
