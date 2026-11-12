import type { PluginContributions } from "@venore/plugin-sdk";
import { colaboraBreadcrumbSegments } from "./breadcrumbs";

export const colaboraContributions: PluginContributions = {
  breadcrumbSegments: colaboraBreadcrumbSegments,
};
