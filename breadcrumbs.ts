import type { BreadcrumbSegmentDefinition } from "@venore/plugin-sdk";
import { dynamicBreadcrumbSegment, staticBreadcrumbSegment } from "@venore/plugin-sdk";

// Admin + portal público (/colabora/…, dentro da casca). A PWA em /ext/colabora/app não usa a casca,
// então não entra aqui. Sem os segmentos públicos a trilha de /colabora/* sai só com "Início".
export const colaboraBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "colabora.admin", segments: ["admin", "colabora"], label: "Colabora" }),

  staticBreadcrumbSegment({ key: "colabora.public", segments: ["colabora"], label: "Colabora" }),
  staticBreadcrumbSegment({ key: "colabora.public.mine", segments: ["colabora", "meus"], label: "Meus chamados" }),
  staticBreadcrumbSegment({ key: "colabora.public.new", segments: ["colabora", "novo"], label: "Abrir chamado" }),
  staticBreadcrumbSegment({ key: "colabora.public.assigned", segments: ["colabora", "atribuidos"], label: "Atribuídos a mim" }),
  staticBreadcrumbSegment({ key: "colabora.public.queue", segments: ["colabora", "fila"], label: "Fila" }),
  staticBreadcrumbSegment({ key: "colabora.public.team", segments: ["colabora", "equipe"], label: "Equipe" }),
  dynamicBreadcrumbSegment({
    key: "colabora.public.team-agent",
    segments: ["colabora", "equipe", ":agentId"],
    paramName: "agentId",
    resolveLabel: () => "Agente",
  }),
  // "chamado" sozinho não tem página (só /chamado/:ticketId): href null evita um link quebrado.
  staticBreadcrumbSegment({ key: "colabora.public.ticket-root", segments: ["colabora", "chamado"], label: "Chamado", href: null }),
  dynamicBreadcrumbSegment({
    key: "colabora.public.ticket",
    segments: ["colabora", "chamado", ":ticketId"],
    paramName: "ticketId",
    resolveLabel: (ticketId) => `#${ticketId}`,
  }),
];
