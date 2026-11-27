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

// Medição (diagnóstico de desempenho): com COLABORA_TIMING=1, cada chamada ao Zammad registra método, caminho
// (sem os valores da query, que podem ter e-mail), status e duração. Desligado por padrão.
const TIMING = process.env.COLABORA_TIMING === "1";

function logTiming(method: string, path: string, status: number | "erro", startedAt: number): void {
  if (!TIMING) return;
  const [base, query] = path.split("?");
  const keys = query ? `?${[...new URLSearchParams(query).keys()].join("&")}` : "";
  console.info(`[colabora:zammad] ${method} ${base.replace(/^\/+/, "")}${keys} ${status} ${Math.round(performance.now() - startedAt)}ms`);
}

// Quem guarda leituras do Zammad em cache se registra aqui para ser avisado de toda ESCRITA bem-sucedida (qualquer
// POST/PUT feito por este cliente): a pessoa que acabou de agir precisa ver a própria mudança na tela. A lista fica em
// `globalThis` porque o Next pode carregar este módulo mais de uma vez no mesmo processo.
type WriteListener = () => void;
const registry = globalThis as typeof globalThis & { __colaboraWriteListeners?: WriteListener[] };

export function onZammadWrite(listener: WriteListener): void {
  (registry.__colaboraWriteListeners ??= []).push(listener);
}

function notifyWrite(): void {
  for (const listener of registry.__colaboraWriteListeners ?? []) {
    try {
      listener();
    } catch {
      // um cache com defeito não pode derrubar a escrita
    }
  }
}

export const NOT_CONFIGURED_MESSAGE =
  "A integração com o Zammad não está configurada (variáveis ZAMMAD_URL e ZAMMAD_API_TOKEN).";

// Escrita (POST/PUT) EXIGE `onBehalfOf`: o histórico do Zammad precisa mostrar a pessoa real como autora, não o dono
// do token. O tipo garante isso em tempo de compilação; uma escrita sem pessoa nem chega ao Zammad.
type ReadOptions = { method?: "GET"; body?: undefined; onBehalfOf?: string; timeoutMs?: number };
type WriteOptions = { method: "POST" | "PUT"; body?: unknown; onBehalfOf: string; timeoutMs?: number };
type RequestOptions = ReadOptions | WriteOptions;

export const MISSING_ACTOR_MESSAGE = "Escrita no Zammad sem a pessoa que age (X-On-Behalf-Of).";

export async function zammadRequest<T>(path: string, options: RequestOptions = {}): Promise<OperationResult<T>> {
  const connection = readConnection();
  if (!connection) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
  // Reforço em tempo de execução (o tipo já exige): e-mail vazio também não serve.
  if (options.method && options.method !== "GET" && !options.onBehalfOf?.trim()) return failure("missing_actor", MISSING_ACTOR_MESSAGE);

  const headers: Record<string, string> = {
    Authorization: `Token token=${connection.token}`,
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.onBehalfOf) headers["X-On-Behalf-Of"] = options.onBehalfOf;

  const method = options.method ?? "GET";
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}/api/v1/${path.replace(/^\/+/, "")}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
  } catch (error) {
    logTiming(method, path, "erro", startedAt);
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return failure(
      "unreachable",
      timedOut ? "O Zammad demorou demais para responder. Tente de novo em instantes." : "Não foi possível falar com o Zammad agora.",
    );
  }

  const text = await response.text();
  logTiming(method, path, response.status, startedAt);
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
  if (method !== "GET") notifyWrite();
  return { success: true, data: data as T };
}

// Download binário (anexos). Devolve a Response crua do Zammad para o chamador repassar o corpo em
// stream, sem carregar o arquivo inteiro na memória.
export async function zammadFetchRaw(path: string, options: { onBehalfOf: string; timeoutMs?: number }): Promise<OperationResult<Response>> {
  const connection = readConnection();
  if (!connection) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}/api/v1/${path.replace(/^\/+/, "")}`, {
      headers: { Authorization: `Token token=${connection.token}`, "X-On-Behalf-Of": options.onBehalfOf },
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });
  } catch {
    return failure("unreachable", "Não foi possível baixar o arquivo agora. Tente de novo em instantes.");
  }
  if (!response.ok) return failure("attachment_not_found", "Arquivo não encontrado.");
  return { success: true, data: response };
}
