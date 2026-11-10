import "server-only";
import type { OperationResult } from "@venore/plugin-sdk";
import { failure } from "./results";

// Conexão com o Zammad por variáveis de ambiente — o token NUNCA vai para setting (settings são de
// leitura pública no core) nem para o navegador:
//   ZAMMAD_URL        ex.: https://colabora.fem.edu.br
//   ZAMMAD_API_TOKEN  token de acesso de um usuário técnico com permissão admin.user (para o
//                     X-On-Behalf-Of), admin.object e admin.core_workflow (para ler os campos).
// Toda ação da pessoa (abrir chamado, listar os seus) vai com `X-On-Behalf-Of: <e-mail>`: o Zammad
// aplica as permissões DELA (grupos, visibilidade) e registra o chamado como criado por ela.

export type ZammadConnection = { baseUrl: string; token: string };

export function readConnection(): ZammadConnection | null {
  const baseUrl = process.env.ZAMMAD_URL?.trim().replace(/\/+$/, "");
  const token = process.env.ZAMMAD_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

export const NOT_CONFIGURED_MESSAGE =
  "A integração com o Zammad não está configurada (variáveis ZAMMAD_URL e ZAMMAD_API_TOKEN).";

export function ticketUrl(baseUrl: string, ticketId: number): string {
  return `${baseUrl}/#ticket/zoom/${ticketId}`;
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  onBehalfOf?: string;
  timeoutMs?: number;
};

export async function zammadRequest<T>(path: string, options: RequestOptions = {}): Promise<OperationResult<T>> {
  const connection = readConnection();
  if (!connection) return failure("not_configured", NOT_CONFIGURED_MESSAGE);

  const headers: Record<string, string> = {
    Authorization: `Token token=${connection.token}`,
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.onBehalfOf) headers["X-On-Behalf-Of"] = options.onBehalfOf;

  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}/api/v1/${path.replace(/^\/+/, "")}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return failure(
      "unreachable",
      timedOut ? "O Zammad demorou demais para responder. Tente de novo em instantes." : "Não foi possível falar com o Zammad agora.",
    );
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const human =
      data && typeof data === "object" && "error_human" in data
        ? String((data as { error_human: unknown }).error_human)
        : data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${response.status}`;
    if (response.status === 401) return failure("unauthorized", `O Zammad recusou o token da integração (${human}).`);
    if (response.status === 403) return failure("forbidden", `O Zammad não permitiu esta ação (${human}).`);
    return failure("request_failed", `O Zammad respondeu com erro: ${human}`);
  }
  return { success: true, data: data as T };
}
