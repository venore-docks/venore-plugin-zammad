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
export async function findZammadUserByEmail(email: string): Promise<OperationResult<ZammadUser | null>> {
  const normalized = email.trim().toLowerCase();
  const result = await zammadRequest<ZammadUser[]>(`users/search?query=${encodeURIComponent(`email:"${normalized}"`)}&limit=10`);
  if (!result.success) return result;
  const user = (Array.isArray(result.data) ? result.data : []).find((candidate) => candidate.email?.trim().toLowerCase() === normalized);
  return { success: true, data: user ?? null };
}

export async function getTokenOwner(): Promise<OperationResult<ZammadUser>> {
  return zammadRequest<ZammadUser>("users/me");
}
