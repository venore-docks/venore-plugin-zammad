import type { PluginContributions } from "@venore/plugin-sdk";
import { zammadBreadcrumbSegments } from "./breadcrumbs";

export const zammadContributions: PluginContributions = {
  breadcrumbSegments: zammadBreadcrumbSegments,
};
