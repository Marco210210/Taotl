import { getApiBaseUrl, getAppKey, REQUEST_TIMEOUT_MS } from "./config";
import { reportError } from "@/monitoring/errorReporter";

export class ApiUnavailableError extends Error {
  constructor(message = "Backend non configurato o non raggiungibile.") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly method: string,
    readonly diagnostic?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function messageForStatus(status: number): string {
  if (status === 400) return "Controlla i dati inseriti e riprova.";
  if (status === 401) return "Accesso non valido o sessione scaduta.";
  if (status === 403) return "Non hai i permessi per questa operazione.";
  if (status === 404) return "Servizio temporaneamente non disponibile. Riprova tra poco.";
  if (status === 409) return "Questi dati risultano già utilizzati.";
  if (status === 429) return "Troppi tentativi. Attendi qualche minuto e riprova.";
  return "Il server non è riuscito a completare la richiesta. Riprova.";
}

interface ApiErrorDetails {
  message: string;
  diagnostic?: string;
}

async function readErrorDetails(response: Response): Promise<ApiErrorDetails> {
  const text = await response.text().catch(() => "");
  if (text) {
    try {
      const payload = JSON.parse(text) as { message?: unknown; cause?: unknown };
      const cause = typeof payload.cause === "string" ? payload.cause.trim() : "";
      const oracleMessage = cause.match(/ORA-20\d{3}:\s*([^\n]+)/)?.[1]?.trim();
      if (oracleMessage) {
        return { message: oracleMessage, diagnostic: cause.slice(0, 4_000) };
      }
      if (
        typeof payload.message === "string" &&
        payload.message.trim() &&
        payload.message !== "Not Found" &&
        payload.message !== "The request could not be processed for a user defined resource"
      ) {
        return { message: payload.message.trim(), diagnostic: text.slice(0, 4_000) };
      }
      return { message: messageForStatus(response.status), diagnostic: (cause || text).slice(0, 4_000) };
    } catch {
      // La risposta non è JSON: si usa il messaggio sicuro associato allo status.
      return { message: messageForStatus(response.status), diagnostic: text.slice(0, 4_000) };
    }
  }
  return { message: messageForStatus(response.status) };
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiUnavailableError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const appKey = getAppKey();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (appKey) headers["X-App-Key"] = appKey;
    if (options.body && !headers["Content-Type"] && typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await readErrorDetails(response);
      const requestError = new ApiRequestError(
        details.message,
        response.status,
        path,
        options.method ?? "GET",
        details.diagnostic,
      );
      reportError("api.request", requestError, {
        path,
        method: requestError.method,
        status: response.status,
        diagnostic: details.diagnostic,
      });
      throw requestError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as T | { items: T };
      if (
        payload !== null &&
        typeof payload === "object" &&
        "items" in payload &&
        Array.isArray((payload as { items: unknown }).items)
      ) {
        return (payload as { items: T }).items;
      }
      return payload as T;
    }
    return undefined as T;
  } catch (err) {
    if (err instanceof ApiUnavailableError || err instanceof ApiRequestError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutError = new Error("Il server non ha risposto in tempo.");
      reportError("api.timeout", timeoutError, { path, method: options.method ?? "GET" });
      throw timeoutError;
    }
    reportError("api.network", err, { path, method: options.method ?? "GET" });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  getAuthenticated: <T>(path: string, token: string) =>
    request<T>(path, { method: "GET", headers: { Authorization: `Bearer ${token}` } }),
  postAuthenticated: <T>(path: string, token: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  deleteAuthenticated: <T>(path: string, token: string) =>
    request<T>(path, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  putBinary: <T>(path: string, body: Blob, contentType: string) =>
    request<T>(path, { method: "PUT", body: body as unknown as BodyInit, headers: { "Content-Type": contentType } }),
};

export function photoUrlForPlayer(playerId: string, version?: number): string | null {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  const suffix = version === undefined ? "" : `?v=${version}`;
  return `${baseUrl}/players/${playerId}/photo${suffix}`;
}
