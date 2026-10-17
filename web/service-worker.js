/* La build sostituisce questi valori con l'elenco esatto dei file pubblicati. */
const CACHE_PREFIX = "taotl-shell-";
const CACHE_NAME = CACHE_PREFIX + __BUILD_ID__;
const FILES = __PRECACHE_FILES__;
const INDEX_HASH = __INDEX_HASH__;
const STATIC_PATHS = new Set(FILES);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Non attivare una versione incompleta se cade la rete durante il download.
      await cache.addAll(FILES.map(path => new Request(path, { cache: "reload" })));
      const html = await cache.match("/index.html");
      const digest = await crypto.subtle.digest("SHA-256", await html.arrayBuffer());
      const actualHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (actualHash !== INDEX_HASH) throw new Error("La release è cambiata durante l'installazione. Riprova online.");
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const versions = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
    // Conserva anche la release precedente per le schede ancora aperte.
    await Promise.all(versions.slice(0, -1).map(key => caches.delete(key)));
    await self.clients.claim();
    // Nessun reload automatico: una partita in corso deve restare aperta.
  })());
});

async function navigate(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok && response.headers.get("content-type")?.includes("text/html")) return response;
  } catch {
    // Rete assente o troppo lenta: usa la versione completa già installata.
  } finally {
    clearTimeout(timeout);
  }
  return (await caches.open(CACHE_NAME)).match("/index.html");
}

async function staticFile(request, pathname) {
  const current = await caches.open(CACHE_NAME);
  const cached = await current.match(pathname);
  if (cached) return cached;
  // Bundle con hash della release precedente, mai risposte API o pagine private.
  for (const key of (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)) {
    const previous = await (await caches.open(key)).match(pathname);
    if (previous) return previous;
  }
  return fetch(request);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("authorization")) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else if (STATIC_PATHS.has(url.pathname) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_expo/")) {
    event.respondWith(staticFile(request, url.pathname));
  }
});
