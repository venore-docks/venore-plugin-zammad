import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadAttribute, ZammadGroup, ZammadSchema, ZammadUser, ZammadWorkflow } from "../contracts/zammad";
import { zammadRequest } from "./zammad-client";

// Grupos, atributos e Core Workflows mudam raramente: cache em memória por processo. A tela de admin
// tem "Recarregar do Zammad" (zera o cache deste processo; os outros expiram sozinhos).
const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; schema: ZammadSchema } | null = null;

export function clearSchemaCache(): void {
  cached = null;
  userCache.clear();
}

export async function loadSchema(options: { fresh?: boolean } = {}): Promise<OperationResult<ZammadSchema>> {
  if (!options.fresh && cached && Date.now() - cached.at < TTL_MS) return { success: true, data: cached.schema };

  const [groups, attributes, workflows] = await Promise.all([
    zammadRequest<ZammadGroup[]>("groups"),
    zammadRequest<ZammadAttribute[]>("object_manager_attributes"),
    zammadRequest<ZammadWorkflow[]>("core_workflows"),
  ]);
  if (!groups.success) return groups;
  if (!attributes.success) return attributes;
  if (!workflows.success) return workflows;

  const schema: ZammadSchema = {
    groups: groups.data,
    attributes: attributes.data.filter((attribute) => attribute.object === "Ticket"),
    workflows: workflows.data.filter((workflow) => workflow.object === "Ticket"),
    fetchedAt: new Date().toISOString(),
  };
  cached = { at: Date.now(), schema };
  return { success: true, data: schema };
}

// Conta do Zammad com o mesmo e-mail da conta do portal (as contas são as mesmas nos dois sistemas).
// A conta é lida em TODA tela (é quem pede). Cache em memória de 5 min, só para contas encontradas e ativas: papéis
// e grupos novos no Zammad chegam em até 5 min; conta inexistente ou desativada é conferida de novo a cada vez
// (quem acabou de ganhar acesso não espera).
const USER_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { at: number; user: ZammadUser }>();

export async function findZammadUserByEmail(email: string): Promise<OperationResult<ZammadUser | null>> {
  const normalized = email.trim().toLowerCase();
  const hit = userCache.get(normalized);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return { success: true, data: hit.user };
  const result = await zammadRequest<ZammadUser[]>(`users/search?query=${encodeURIComponent(`email:"${normalized}"`)}&limit=10`);
  if (!result.success) return result;
  const user = (Array.isArray(result.data) ? result.data : []).find((candidate) => candidate.email?.trim().toLowerCase() === normalized);
  if (user?.active) {
    if (userCache.size > 1000) userCache.clear();
    userCache.set(normalized, { at: Date.now(), user });
  }
  return { success: true, data: user ?? null };
}

export async function getTokenOwner(): Promise<OperationResult<ZammadUser>> {
  return zammadRequest<ZammadUser>("users/me");
}
