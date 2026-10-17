(() => {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const notify = state => {
    document.documentElement.dataset.taotlOfflineState = state;
    window.dispatchEvent(new CustomEvent("taotl:offline-state", { detail: state }));
  };
  // navigator.onLine può restare true con Wi-Fi senza Internet o dopo una
  // riapertura. Verifica il sito con HEAD, senza passare dalla cache offline.
  const connection = online => {
    document.documentElement.dataset.taotlOnline = String(online);
    window.dispatchEvent(new Event("taotl:network-state"));
  };
  let checking = false;
  const checkConnection = async () => {
    if (!navigator.onLine) { connection(false); return; }
    if (checking) return;
    checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch("/manifest.json", { method: "HEAD", cache: "no-store", signal: controller.signal });
      connection(response.ok);
    } catch { connection(false); }
    finally { clearTimeout(timeout); checking = false; }
  };
  window.addEventListener("offline", () => connection(false));
  window.addEventListener("online", checkConnection);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkConnection();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void checkConnection();
  }, 30000);
  void checkConnection();
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const watch = worker => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") notify("ready");
          if (worker.state === "redundant" && !registration.active) notify("error");
        });
      };
      if (registration.active) notify("ready");
      watch(registration.installing);
      registration.addEventListener("updatefound", () => watch(registration.installing));
      window.addEventListener("online", () => void registration.update().catch(() => {}));
    } catch {
      notify("error");
    }
  };
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", register, { once: true });
})();
