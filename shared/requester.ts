import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { authorizeActor } from "@venore/plugin-sdk/rbac";
import type { ZammadUser } from "../contracts/zammad";
import { ZAMMAD_PERMISSIONS } from "./permissions";
import { failure } from "./results";
import { findZammadUserByEmail } from "./schema";

// Quem está abrindo/consultando chamados: usuário logado no portal, com `zammad.tickets`, e a conta
// dele no Zammad (mesmo e-mail).
export type Requester = {
  actorId: string;
  email: string;
  name: string | null;
  avatarMediaId: string | null;
  image: string | null;
  zammadUser: ZammadUser;
};

export async function resolveRequester(): Promise<OperationResult<Requester>> {
  const authz = await authorizeActor(ZAMMAD_PERMISSIONS.tickets);
  if (!authz.authorized) return { success: false, error: authz.error };

  const current = await getCurrentUser();
  if (!current.success) return current;
  const email = current.data?.email?.trim();
  if (!current.data || !email) return failure("no_email", "Sua conta do portal não tem e-mail — não dá para achar sua conta no Zammad.");

  const found = await findZammadUserByEmail(email);
  if (!found.success) return found;
  if (!found.data) {
    return failure(
      "zammad_user_not_found",
      `Não encontramos uma conta no Zammad com o e-mail ${email}. Procure o suporte para criar o seu acesso.`,
    );
  }
  if (!found.data.active) return failure("zammad_user_inactive", "Sua conta no Zammad está desativada. Procure o suporte.");

  return {
    success: true,
    data: {
      actorId: authz.actorId,
      email,
      name: current.data.name,
      avatarMediaId: current.data.avatarMediaId,
      image: current.data.image,
      zammadUser: found.data,
    },
  };
}
