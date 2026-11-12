import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { authorizeActor } from "@venore/plugin-sdk/rbac";
import type { ZammadUser } from "../contracts/zammad";
import { COLABORA_PERMISSIONS } from "./permissions";
import { failure } from "./results";
import { findZammadUserByEmail } from "./schema";
import { readViewAs, userHasAnyPermission } from "./view-as";

// Quem está abrindo/consultando chamados: usuário logado no portal, com `colabora.tickets`, e a conta
// dele no Zammad (mesmo e-mail).
//
// Com o "ver como" ligado (ver shared/view-as.ts), o solicitante passa a ser a pessoa vista — id do portal,
// e-mail, conta no Zammad e, por consequência, papel no atendimento e setores liberados. `viewAs` diz quem
// está de fato olhando. Toda escrita (`write: true`) é recusada nesse modo.
export type Requester = {
  actorId: string;
  email: string;
  name: string | null;
  avatarMediaId: string | null;
  image: string | null;
  zammadUser: ZammadUser;
  /** Preenchido só no "ver como": o admin que está vendo. */
  viewAs: { adminActorId: string } | null;
};

// Quem pede administra o Colabora? (o admin enxerga todos os setores, como prévia). No "ver como" vale a
// permissão da PESSOA VISTA — senão o admin veria tudo e o teste não mostraria o que ela vê de verdade.
export async function requesterIsColaboraAdmin(requester: Requester): Promise<boolean> {
  if (requester.viewAs) return userHasAnyPermission(requester.actorId, COLABORA_PERMISSIONS.settingsManage);
  return (await authorizeActor(COLABORA_PERMISSIONS.settingsManage)).authorized;
}

export const VIEW_AS_READ_ONLY = "Você está no modo “ver como”, que é só leitura. Saia dele para abrir, responder ou alterar chamados.";

export async function resolveRequester(options: { write?: boolean } = {}): Promise<OperationResult<Requester>> {
  const authz = await authorizeActor(COLABORA_PERMISSIONS.tickets);
  if (!authz.authorized) return { success: false, error: authz.error };

  const current = await getCurrentUser();
  if (!current.success) return current;
  if (!current.data) return failure("no_session", "Entre no portal para usar o Colabora.");

  const target = await readViewAs(authz.actorId);
  if (target) {
    if (options.write) return failure("view_as_read_only", VIEW_AS_READ_ONLY);
    if (!target.hasAccess) {
      return failure("view_as_no_access", `${target.name ?? target.email} não tem acesso ao Colabora (falta a permissão “colabora.tickets” no portal).`);
    }
  }

  const who = target
    ? { actorId: target.id, email: target.email.trim(), name: target.name, avatarMediaId: null, image: null }
    : { actorId: authz.actorId, email: current.data.email?.trim() ?? "", name: current.data.name, avatarMediaId: current.data.avatarMediaId, image: current.data.image };
  if (!who.email) return failure("no_email", "Sua conta do portal não tem e-mail — não dá para achar sua conta no Zammad.");

  const found = await findZammadUserByEmail(who.email);
  if (!found.success) return found;
  if (!found.data) {
    return failure(
      "zammad_user_not_found",
      target
        ? `${target.name ?? target.email} não tem conta no Zammad (${who.email}).`
        : `Não encontramos uma conta no Zammad com o e-mail ${who.email}. Procure o suporte para criar o seu acesso.`,
    );
  }
  if (!found.data.active) return failure("zammad_user_inactive", target ? `A conta de ${who.email} no Zammad está desativada.` : "Sua conta no Zammad está desativada. Procure o suporte.");

  return {
    success: true,
    data: { ...who, zammadUser: found.data, viewAs: target ? { adminActorId: authz.actorId } : null },
  };
}
