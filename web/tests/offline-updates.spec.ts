/// <reference types="node" />
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

// Un server isolato permette di cambiare release durante una partita senza
// modificare la build pubblicata o le risposte del backend reale.
test("aggiornamento offline senza reload e rollback se una nuova cache è incompleta", async ({ browser }) => {
  const root = resolve("web-build");
  const original = await readFile(resolve(root, "sw.js"), "utf8");
  let release = "initial";
  const types: Record<string, string> = { ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".ttf": "font/ttf", ".png": "image/png", ".ico": "image/x-icon" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, "http://localhost").pathname;
      if (pathname === "/missing-update.js") { response.writeHead(404).end(); return; }
      if (pathname === "/sw.js") {
        let script = original.replace(/(const CACHE_NAME = CACHE_PREFIX \+ ")([^"]+)(";)/, `$1$2-${release}$3`);
        if (release === "broken") script = script.replace("const FILES = [", 'const FILES = ["/missing-update.js",');
        response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" }).end(script);
        return;
      }
      const file = resolve(root, `.${extname(pathname) ? pathname : "/index.html"}`);
      if (!file.startsWith(root + sep)) { response.writeHead(404).end(); return; }
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Porta di test non disponibile");
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext({ locale: "it-IT" });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/settings`);
    await expect(page.getByText("Disponibile offline su questo dispositivo", { exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem("taotl:active-game:v1", JSON.stringify({
      id: "update-game", mode: "classica", players: [{ id: "a", name: "Anna" }, { id: "b", name: "Bruno" }], startDealerId: "b", status: "bidding", rounds: [], pendingCardsDealt: 25, pendingBids: [], pendingBidDrafts: [], pendingResultDrafts: [], saveToAlbo: false, leaderboardId: null, createdAt: "2026-10-17T10:00:00Z", finishedAt: null,
    })));
    await page.goto(`${origin}/game/bids`);
    await page.getByRole("button", { name: "Aumenta", exact: true }).first().click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("taotl:active-game:v1")!).pendingBidDrafts[0]?.bid)).toBe(1);
    await page.evaluate(() => { document.documentElement.dataset.testNoReload = "partita-aperta"; });
    release = "updated";
    await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!;
      const changed = new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
      await registration.update();
      await changed;
    });
    await expect(page).toHaveURL(/\/game\/bids$/);
    expect(await page.evaluate(() => document.documentElement.dataset.testNoReload)).toBe("partita-aperta");
    const versions = await page.evaluate(() => caches.keys());
    expect(versions.filter(key => key.startsWith("taotl-shell-"))).toHaveLength(2);
    release = "broken";
    await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!;
      const failed = new Promise<void>(resolve => registration.addEventListener("updatefound", () => {
        const worker = registration.installing!;
        worker.addEventListener("statechange", () => { if (worker.state === "redundant") resolve(); });
      }, { once: true }));
      await registration.update();
      await failed;
    });
    expect(await page.evaluate(() => caches.keys())).toEqual(versions);
    await context.setOffline(true);
    const response = await page.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole("button", { name: /Registra gli esiti/ })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("taotl:active-game:v1")!).pendingBidDrafts[0].bid)).toBe(1);
  } finally {
    await context.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
