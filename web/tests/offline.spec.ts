import { test, expect, type Page } from "@playwright/test";

// Il service worker non intercetta API: tutte le API dei test sono simulate.
test.beforeEach(async ({ context, baseURL }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === baseURL || !url.protocol.startsWith("http") ? route.continue() : route.abort();
  });
});

async function installed(page: Page) {
  await page.goto("/settings");
  await expect(page.getByText("Disponibile offline su questo dispositivo", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

async function storedGame(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("taotl:active-game:v1") || "null"));
}

test("offline reale: riapertura, foto, nuova partita completa e storico", async ({ page, context }) => {
  await installed(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Continua senza account" }).click();
  await page.goto("/roster/edit");
  await page.getByPlaceholder("Nome giocatore").fill("Anna Offline");
  const picker = page.waitForEvent("filechooser");
  await page.getByText(/Tocca.*foto/).click();
  await (await picker).setFiles("assets/icon.png");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page).toHaveURL(/\/roster$/);
  const roster = await page.evaluate(() => JSON.parse(localStorage.getItem("taotl:roster-cache:v1") || "[]"));

  await context.setOffline(true);
  const offline = await context.newPage();
  // Applica anche al nuovo target Chromium lo stato della rete emulata.
  await context.setOffline(true);
  await page.close();
  const response = await offline.goto(`/roster/edit?id=${roster[0].id}`);
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(offline.getByPlaceholder("Nome giocatore")).toHaveValue("Anna Offline");
  await expect(offline.getByText("Offline · stai usando i dati salvati su questo dispositivo", { exact: true })).toBeVisible();
  await expect.poll(() => offline.locator("img").evaluateAll(images => images.some(img =>
    img instanceof HTMLImageElement && img.src.startsWith("data:image/jpeg") && img.complete && img.naturalWidth > 0))).toBe(true);
  await offline.goto("/");
  await offline.getByText("Nuova partita", { exact: true }).click();
  await offline.getByPlaceholder("Cerca un giocatore per nome").fill("Anna Offline");
  await offline.getByText("Anna Offline", { exact: true }).click();
  await offline.getByPlaceholder("Cerca un giocatore per nome").fill("Bruno Offline");
  await offline.getByRole("button", { name: "Crea nuovo giocatore “Bruno Offline”" }).click();
  await offline.getByRole("button", { name: /Ordine e mazziere/ }).click();
  await offline.getByRole("radio", { name: /Anna Offline/ }).click();
  await offline.getByRole("button", { name: /Scegli la modalità/ }).click();
  await offline.getByRole("radio").filter({ hasText: "Classica" }).click();
  await offline.getByRole("button", { name: /Inizia la partita/ }).click();
  await offline.getByRole("button", { name: "Aumenta", exact: true }).first().click();
  await expect.poll(async () => (await storedGame(offline))?.pendingBidDrafts?.[0]?.bid).toBe(1);
  await offline.reload();
  for (let round = 1; round <= 6; round++) {
    await offline.getByRole("button", { name: /Registra gli esiti/ }).click();
    await offline.getByText("Rispettata", { exact: true }).first().click();
    await offline.getByText("Sbagliata", { exact: true }).last().click();
    if (round === 1) {
      await expect.poll(async () => (await storedGame(offline))?.pendingResultDrafts?.length).toBe(2);
      await offline.reload();
    }
    await offline.getByRole("button", { name: /Chiudi il turno/ }).click();
    await expect.poll(async () => (await storedGame(offline))?.rounds.length).toBe(round);
    if (round < 6) await offline.getByRole("button", { name: new RegExp(`^Turno ${round + 1}`) }).click();
  }
  const id = (await storedGame(offline)).id;
  await offline.getByRole("button", { name: "Salva sul telefono", exact: true }).click();
  const history = await context.newPage();
  await context.setOffline(true);
  await offline.close();
  await history.goto(`/history/${id}`);
  await expect(history.getByText("Anna Offline", { exact: true }).first()).toBeVisible();
  await expect(history.getByText("Bruno Offline", { exact: true }).first()).toBeVisible();
  expect(await history.evaluate(async () => {
    try { await fetch("/manifest.json", { method: "HEAD", cache: "no-store" }); return false; }
    catch { return true; }
  })).toBe(true);
});

const account = { id: "offline-user", handle: "offline_user", displayName: "Utente Offline", email: "offline@example.test", isAdmin: false, leaderboards: ["offline-board"], defaultLeaderboardId: "offline-board" };
const board = { id: "offline-board", name: "Classifica Offline", role: "member", visibility: "private", canManage: false, canSubmit: true };

async function cacheAccount(page: Page) {
  await page.addInitScript(account => {
    if (!localStorage.getItem("offline-test-seeded")) {
      localStorage.setItem("taotl.auth-session.v1", "offline-session");
      localStorage.setItem("taotl.account-cache.v1", JSON.stringify(account));
      localStorage.setItem("offline-test-seeded", "yes");
    }
  }, account);
}

async function cachedReadKeys(page: Page) {
  return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("taotl:offline-reads:v1:")));
}

test("il timeout del controllo sessione conserva account e token locali", async ({ page, context }) => {
  await cacheAccount(page);
  const reports: { source: string }[] = [];
  await context.route("**/taotl/auth/me/", () => new Promise(() => {}));
  await context.route("**/*", async route => {
    if (route.request().method() === "POST" && route.request().postData()?.includes('"source":"api.timeout"')) {
      reports.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true } });
    } else await route.fallback();
  });
  await page.goto("/account");
  await expect.poll(() => reports.some(report => report.source === "api.timeout"), { timeout: 15_000 }).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("taotl.auth-session.v1"))).toBe("offline-session");
  await expect(page.getByRole("button", { name: /Esci/ }).first()).toBeVisible();
});

test("account e classifica in memoria; salvataggio offline e sincronizzazione al rientro", async ({ page, context }) => {
  await cacheAccount(page);
  await context.route("**/taotl/auth/me/", route => route.fulfill({ json: account }));
  await context.route("**/taotl/leaderboards/", route => route.fulfill({ json: [board] }));
  await context.route("**/taotl/leaderboards/offline-board/", route => route.fulfill({ json: [{ playerId: "a", name: "Anna in classifica", gamesPlayed: 7, wins: 3, rateWins: 43 }] }));
  await installed(page);
  await page.goto("/leaderboard");
  await expect(page.getByText("Anna in classifica", { exact: true })).toBeVisible();
  await expect.poll(() => cachedReadKeys(page)).toHaveLength(1);
  await page.evaluate(() => localStorage.setItem("taotl:active-game:v1", JSON.stringify({
    id: "offline-finished", mode: "classica", players: [{ id: "a", name: "Anna" }, { id: "b", name: "Bruno" }], startDealerId: "a", status: "finished",
    rounds: [25, 15, 10, 3, 2, 1].map((cardsDealt, i) => ({ info: { index: i + 1, cardsDealt, presaValue: 5 * (i + 1), rispettoValue: 10 * (i + 1), dealerId: i % 2 ? "b" : "a", biddingOrder: ["a", "b"] }, results: [{ playerId: "a", bid: 0, respected: true, scarto: 0, score: 10 * (i + 1) }, { playerId: "b", bid: 0, respected: false, scarto: 1, score: -5 * (i + 1) }] })),
    pendingCardsDealt: null, pendingBids: [], pendingResultDrafts: [], saveToAlbo: true, leaderboardId: "offline-board", leaderboardName: "Classifica Offline", createdAt: "2026-10-15T10:00:00Z", finishedAt: "2026-10-15T11:00:00Z",
  })));
  await context.setOffline(true);
  // Non si simula l'offline solo con un errore API: il browser perde davvero la rete.
  await context.unroute("**/taotl/leaderboards/");
  await context.unroute("**/taotl/leaderboards/offline-board/");
  await context.unroute("**/taotl/auth/me/");
  const offline = await context.newPage();
  // Applica anche al nuovo target Chromium lo stato della rete emulata.
  await context.setOffline(true);
  await page.close();
  await offline.goto("/leaderboard");
  await expect(offline.getByText("Anna in classifica", { exact: true })).toBeVisible();
  await offline.goto("/game/end");
  await offline.getByRole("button", { name: "Salva senza classifica", exact: true }).click();
  await expect.poll(() => offline.evaluate(() => JSON.parse(localStorage.getItem("taotl:pending-sync-games:v1") || "[]").length)).toBe(1);

  await context.setOffline(false);
  const payloads: { id: string; leaderboardId: string | null }[] = [];
  await context.route("**/taotl/auth/me/", route => route.fulfill({ json: account }));
  await context.route("**/taotl/games/", route => {
    if (route.request().method() === "POST") payloads.push(route.request().postDataJSON());
    return route.fulfill({ json: [] });
  });
  await offline.goto("/");
  await offline.getByRole("button", { name: "Sincronizza", exact: true }).click();
  await expect.poll(() => offline.evaluate(() => JSON.parse(localStorage.getItem("taotl:pending-sync-games:v1") || "[]").length)).toBe(0);
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({ id: "offline-finished", leaderboardId: null });
  // Le risposte private non finiscono nella cache dei file dell'app.
  const shellURLs = await offline.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat());
  expect(shellURLs.some(url => url.includes("/taotl/"))).toBe(false);
  await offline.goto("/account?mode=login");
  await offline.getByRole("button", { name: /Esci/ }).click();
  await offline.getByRole("button", { name: /Esci/ }).last().click();
  await expect.poll(() => cachedReadKeys(offline)).toHaveLength(0);
});

test("un permesso rifiutato non restituisce una classifica dalla cache", async ({ page, context }) => {
  await cacheAccount(page);
  await context.route("**/taotl/auth/me/", route => route.fulfill({ json: account }));
  await context.route("**/taotl/leaderboards/", route => route.fulfill({ json: [board] }));
  await context.route("**/taotl/leaderboards/offline-board/", route => route.fulfill({ json: [{ playerId: "a", name: "Anna in classifica", gamesPlayed: 7, wins: 3, rateWins: 43 }] }));
  await installed(page);
  await page.goto("/leaderboard");
  await expect(page.getByText("Anna in classifica", { exact: true })).toBeVisible();
  await context.route("**/taotl/leaderboards/", route => route.fulfill({ status: 403, json: { message: "Accesso alla classifica revocato" } }));
  await page.reload();
  await expect(page.getByText("Accesso alla classifica revocato", { exact: true })).toBeVisible();
  await expect(page.getByText("Anna in classifica", { exact: true })).toHaveCount(0);
  await expect.poll(() => cachedReadKeys(page)).toHaveLength(0);
});
