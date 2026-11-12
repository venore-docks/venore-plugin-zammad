import { createHmac, timingSafeEqual } from "node:crypto";

// Token do "ver como" (cookie). Puro, sem servidor: assina e confere. Formato: base64url(JSON).hmac.
//   by      quem está vendo (id do admin no portal) — o token só vale para essa sessão
//   target  quem está sendo visto (id do usuário no portal)
//   exp     expira em (epoch, segundos)
export type ViewAsPayload = { by: string; target: string; exp: number };

export const VIEW_AS_TTL_SECONDS = 2 * 60 * 60;

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(`colabora.view-as:${body}`).digest("base64url");
}

export function signViewAs(payload: ViewAsPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

// null = inválido, adulterado, expirado ou de outra pessoa.
export function verifyViewAs(token: string, secret: string, actorId: string, nowSeconds: number): ViewAsPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmac(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { by, target, exp } = payload as Record<string, unknown>;
  if (typeof by !== "string" || typeof target !== "string" || typeof exp !== "number") return null;
  if (by !== actorId || exp <= nowSeconds || target === by) return null;
  return { by, target, exp };
}
