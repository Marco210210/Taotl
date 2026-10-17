import { FALLBACK_REQUEST_TIMEOUT_MS } from "./config";
import { ApiRequestError } from "./client";

const PREFIX = "taotl:offline-reads:v1:";
async function sessionKey(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return PREFIX + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function clearOfflineReads(token: string): Promise<void> {
  try { localStorage.removeItem(await sessionKey(token)); } catch { /* Storage non disponibile. */ }
}

// Solo le letture esplicitamente abilitate usano questo fallback. I permessi
// rifiutati dal server non diventano mai un successo grazie alla cache.
export async function offlineRead<T>(token: string, path: string, load: (timeoutMs?: number) => Promise<T>): Promise<T> {
  let key: string | null = null;
  try { key = await sessionKey(token); } catch { /* Il comportamento online resta disponibile. */ }
  try {
    const result = await load(FALLBACK_REQUEST_TIMEOUT_MS);
    if (key) {
      try {
        const entries = JSON.parse(localStorage.getItem(key) ?? "{}");
        entries[path] = result;
        localStorage.setItem(key, JSON.stringify(entries));
      } catch { /* Una quota piena non deve bloccare la lettura online. */ }
    }
    return result;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.status === 401 || error.status === 403) await clearOfflineReads(token);
      throw error;
    }
    if (key) {
      try {
        const entries = JSON.parse(localStorage.getItem(key) ?? "{}");
        if (Object.hasOwn(entries, path)) return entries[path] as T;
      } catch { /* Cache corrotta: mostra l'errore originale. */ }
    }
    throw error;
  }
}
