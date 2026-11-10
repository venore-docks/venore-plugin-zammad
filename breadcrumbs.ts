import type { BreadcrumbSegmentDefinition } from "@venore/plugin-sdk";
import { staticBreadcrumbSegment } from "@venore/plugin-sdk";

export const zammadBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "zammad.admin", segments: ["admin", "zammad"], label: "Chamados" }),
];
