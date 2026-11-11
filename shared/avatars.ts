import "server-only";
import { findUserByEmail } from "@venore/plugin-sdk/auth";
import { getMediaAssetUrls } from "@venore/plugin-sdk/media";
import type { Requester } from "./requester";
import { getPerson } from "./people";

// Avatar de quem escreveu cada mensagem, vindo da conta do PORTAL (as contas são as mesmas nos dois
// sistemas, casadas pelo e-mail). Quem não tem conta no portal, ou não tem avatar, fica com as iniciais.
//
//   eu       → avatar da sessão (avatarMediaId escolhido na conta, ou a foto do provedor OAuth)
//   equipe   → Zammad users/:id (com o token da integração) → e-mail → conta do portal → avatar
//
// Falha em qualquer passo = sem avatar; nunca derruba a conversa.

const AVATAR_WIDTH = 72;

type Pending = { zammadUserId: number; mediaId: string | null; image: string | null };

// Devolve zammadUserId → url do avatar (só os que têm).
export async function resolveAvatars(requester: Requester, authorIds: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(authorIds)].filter((id) => id > 1);
  const pending: Pending[] = [];

  await Promise.all(
    unique.map(async (zammadUserId) => {
      if (zammadUserId === requester.zammadUser.id) {
        pending.push({ zammadUserId, mediaId: requester.avatarMediaId, image: requester.image });
        return;
      }
      const person = await getPerson(zammadUserId);
      if (!person?.email) return;
      const user = await findUserByEmail({ email: person.email });
      if (user.success) pending.push({ zammadUserId, mediaId: user.data.avatarMediaId, image: user.data.image });
    }),
  );

  const mediaIds = [...new Set(pending.map((entry) => entry.mediaId).filter((id): id is string => Boolean(id)))];
  let urls: Record<string, string> = {};
  if (mediaIds.length > 0) {
    const resolved = await getMediaAssetUrls({ ids: mediaIds, displayWidth: AVATAR_WIDTH });
    if (resolved.success) urls = resolved.data;
  }

  const avatars = new Map<number, string>();
  for (const entry of pending) {
    const url = (entry.mediaId ? urls[entry.mediaId] : undefined) ?? entry.image;
    if (url) avatars.set(entry.zammadUserId, url);
  }
  return avatars;
}
