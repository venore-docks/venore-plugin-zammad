import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import type { ZammadExpandedTicket } from "../contracts/zammad";
import type { Requester } from "./requester";
import { failure } from "./results";
import { zammadRequest } from "./zammad-client";

// Vínculos pai/filho do Zammad (GET /links, POST /links/add|remove), sempre em nome de quem pede. O tipo do
// vínculo é relativo ao chamado consultado: na lista do PAI, cada filho vem como `child`; na do filho, o pai vem
// como `parent`.
type LinkEntry = { link_type?: string; link_object?: string; link_object_value?: number | string };
type LinksResponse = { links?: LinkEntry[] };

const MAX_LINKED = 20;

async function listLinks(requester: Requester, ticketId: number): Promise<LinkEntry[]> {
  const query = new URLSearchParams({ link_object: "Ticket", link_object_value: String(ticketId) });
  const result = await zammadRequest<LinksResponse>(`links?${query.toString()}`, { onBehalfOf: requester.email });
  if (!result.success || !Array.isArray(result.data?.links)) return [];
  return result.data.links.filter((link) => link.link_object === "Ticket");
}

export type LinkedTickets = { parent: ZammadExpandedTicket | null; children: ZammadExpandedTicket[] };

// Pai e filhos de um chamado, já com os dados (estado, título, responsável). Chamado vinculado que a pessoa não
// pode ver fica de fora. Falha = sem vínculos (nunca derruba a tela do chamado).
export async function loadLinkedTickets(requester: Requester, ticketId: number): Promise<LinkedTickets> {
  const links = await listLinks(requester, ticketId);
  const wanted = links
    .filter((link) => link.link_type === "parent" || link.link_type === "child")
    .slice(0, MAX_LINKED)
    .map((link) => ({ type: link.link_type as "parent" | "child", id: Number(link.link_object_value) }))
    .filter((link) => Number.isInteger(link.id) && link.id > 0);
  const loaded = await Promise.all(
    wanted.map(async (link) => {
      const found = await zammadRequest<ZammadExpandedTicket>(`tickets/${link.id}?expand=true`, { onBehalfOf: requester.email });
      return found.success ? { type: link.type, ticket: found.data } : null;
    }),
  );
  const present = loaded.filter((entry): entry is { type: "parent" | "child"; ticket: ZammadExpandedTicket } => entry !== null);
  return {
    parent: present.find((entry) => entry.type === "parent")?.ticket ?? null,
    children: present.filter((entry) => entry.type === "child").map((entry) => entry.ticket),
  };
}

function linkBody(type: "parent" | "child", parentId: number, child: { id: number; number: string }) {
  return {
    link_type: type,
    link_object_target: "Ticket",
    link_object_target_value: parentId,
    link_object_source: "Ticket",
    link_object_source_number: child.number,
    link_object_source_value: child.id,
  };
}

// Vincula `child` como filho de `parentId`. A direção do `link_type` no /links/add não é documentada com
// clareza; por isso, depois de vincular, conferimos na lista do pai e invertemos se o filho tiver entrado como pai.
export async function linkChild(requester: Requester, parentId: number, child: { id: number; number: string }): Promise<OperationResult<null>> {
  const added = await zammadRequest("links/add", { method: "POST", onBehalfOf: requester.email, body: linkBody("child", parentId, child) });
  if (!added.success) return added;
  const entry = (await listLinks(requester, parentId)).find((link) => Number(link.link_object_value) === child.id);
  if (entry?.link_type === "child") return { success: true, data: null };
  if (entry?.link_type === "parent") {
    await zammadRequest("links/remove", { method: "POST", onBehalfOf: requester.email, body: linkBody("child", parentId, child) });
    const fixed = await zammadRequest("links/add", { method: "POST", onBehalfOf: requester.email, body: linkBody("parent", parentId, child) });
    if (!fixed.success) return fixed;
    return { success: true, data: null };
  }
  return failure("link_missing", "O chamado filho foi criado, mas o vínculo com o pai não apareceu no Zammad.");
}
