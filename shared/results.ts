import type { OperationResult } from "@venore/plugin-sdk";

export function failure<T = never>(code: string, message: string): OperationResult<T> {
  return { success: false, error: { code: `zammad.${code}`, message } };
}
