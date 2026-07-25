import { getApiBaseUrl, getAppKey, REQUEST_TIMEOUT_MS } from "./config";

export class ApiUnavailableError extends Error {
  constructor(message = "Backend non configurato o non raggiungibile.") {
    super(message);
    this.name = "ApiUnavailableError";
  }
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
      const text = await response.text().catch(() => "");
      throw new Error(`Richiesta fallita (${response.status}): ${text || response.statusText}`);
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
    if (err instanceof ApiUnavailableError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Il server non ha risposto in tempo.");
    }
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
