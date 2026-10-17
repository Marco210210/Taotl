import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ context, baseURL }) => {
  // Nessuna scrittura sul backend reale: le prove usano ospiti o risposte simulate.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === baseURL || !url.protocol.startsWith("http")
      ? route.continue() : route.abort();
  });
});

async function activeGame(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("taotl:active-game:v1") || "null"));
}

test("partita completa, refresh, punteggi e storico", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Continua senza account" }).click();
  await page.getByText("Nuova partita", { exact: true }).click();
  for (const name of ["Anna Web", "Bruno Web"]) {
    await page.getByPlaceholder("Cerca un giocatore per nome").fill(name);
    await page.getByRole("button", { name: `Crea nuovo giocatore “${name}”` }).click();
    await expect(page.getByPlaceholder("Cerca un giocatore per nome")).toHaveValue("");
  }
  await page.getByRole("button", { name: /Ordine e mazziere/ }).click();
  await page.getByRole("radio", { name: /Anna Web/ }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: /Anna Web/ })).toBeVisible();
  await page.getByRole("button", { name: /Scegli la modalità/ }).click();
  await page.getByRole("radio").filter({ hasText: "Classica" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Inizia la partita/ }).click();
  await expect(page).toHaveURL(/\/game\/bids$/);
  await page.getByRole("button", { name: "Aumenta", exact: true }).first().click();
  await expect.poll(async () => (await activeGame(page))?.pendingBidDrafts?.[0]?.bid).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: /Registra gli esiti/ })).toBeVisible();
  await expect(page).toHaveURL(/\/game\/bids$/);
  expect((await activeGame(page)).pendingBidDrafts[0].bid).toBe(1);

  for (let round = 1; round <= 6; round++) {
    await page.getByRole("button", { name: /Registra gli esiti/ }).click();
    await expect(page).toHaveURL(/\/game\/scoring$/);
    await page.getByText("Rispettata", { exact: true }).first().click();
    await page.getByText("Sbagliata", { exact: true }).last().click();
    if (round === 1) {
      await expect.poll(async () => (await activeGame(page))?.pendingResultDrafts?.map((draft: { respected: boolean | null }) => draft.respected)).toEqual([true, false]);
      await page.reload();
      await expect(page.getByRole("button", { name: /Chiudi il turno/ })).toBeEnabled();
      await expect(page).toHaveURL(/\/game\/scoring$/);
    }
    await page.getByRole("button", { name: /Chiudi il turno/ }).click();
    await expect.poll(async () => (await activeGame(page))?.rounds.length).toBe(round);
    const game = await activeGame(page);
    const result = game.rounds[round - 1];
    expect(result.results[0].score).toBe((round === 1 ? 1 : 0) * 5 * round + 10 * round);
    expect(result.results[1].score).toBe(-5 * round);
    if (round < 6) await page.getByRole("button", { name: new RegExp(`^Turno ${round + 1}`) }).click();
  }
  await expect(page.getByText("PARTITA CHIUSA", { exact: true })).toBeVisible();
  const gameId = (await activeGame(page)).id;
  await page.getByRole("button", { name: "Salva sul telefono" }).click();
  await page.goto(`/history/${gameId}`);
  await expect(page.getByText("Anna Web", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Bruno Web", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("foto giocatore persistente dopo la chiusura della pagina", async ({ page, context }) => {
  await page.goto("/roster/edit");
  await page.getByPlaceholder("Nome giocatore").fill("Foto Web");
  const picker = page.waitForEvent("filechooser");
  await page.getByText(/Tocca.*foto/).click();
  await (await picker).setFiles("assets/icon.png");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page).toHaveURL(/\/roster$/);
  const roster = await page.evaluate(() => JSON.parse(localStorage.getItem("taotl:roster-cache:v1") || "[]"));
  expect(roster[0].photoUri).toMatch(/^data:image\/jpeg;base64,/);
  const other = await context.newPage();
  await page.close();
  await other.goto(`/roster/edit?id=${roster[0].id}`);
  await expect(other.getByPlaceholder("Nome giocatore")).toHaveValue("Foto Web");
  await expect.poll(() => other.locator('img').evaluateAll((images) => images.some((img) =>
    img instanceof HTMLImageElement && img.src.startsWith("data:image/jpeg") && img.complete && img.naturalWidth > 0))).toBe(true);
});

test("tema, lingua, navigazione diretta e layout", async ({ page }) => {
  await page.goto("/settings");
  await page.getByText("Scuro", { exact: true }).click();
  await page.getByText("English", { exact: true }).click();
  await page.reload();
  await expect(page.getByText("Dark", { exact: true })).toBeVisible();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem("taotl:app-settings:v1") || "null"));
  expect(settings.theme).toBe("dark");
  expect(settings.language).toBe("en");
  for (const route of ["/rules", "/profile", "/history", "/leaderboard", "/leaderboard/manage", "/account/forgot-password", "/account/reset-password"]) {
    await page.goto(route);
    await expect(page.locator("#root")).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("accesso, ripristino sessione e uscita con API simulata", async ({ page }) => {
  const account = {
    id: "web-test", handle: "web_test", displayName: "Utente Web", firstName: "Utente", lastName: "Web",
    email: "test@example.test", isAdmin: false, linkedPlayerId: null, leaderboards: [],
    defaultLeaderboardId: null, createdAt: "2026-01-01T00:00:00Z",
  };
  await page.route("**/taotl/auth/login/", (route) => route.fulfill({ json: { token: "test-session", account } }));
  await page.route("**/taotl/auth/me/", (route) => route.fulfill({ json: account }));
  await page.route("**/taotl/leaderboards/", (route) => route.fulfill({ json: [] }));
  await page.route("**/taotl/auth/logout/", (route) => route.fulfill({ json: {} }));
  await page.goto("/account?mode=login");
  await page.getByPlaceholder("email@example.com oppure marco21").fill("web_test");
  await page.getByPlaceholder("••••••••", { exact: true }).fill("Password123");
  await page.getByRole("button", { name: "Accedi al Taotl ID", exact: true }).click();
  await expect(page.getByText("Utente Web", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Utente Web", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("taotl.auth-session.v1"))).toBe("test-session");
  await page.getByRole("button", { name: /Esci/ }).click();
  await page.getByRole("button", { name: /Esci/ }).last().click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("taotl.auth-session.v1"))).toBeNull();
});

function fixtureGame(status = "bidding", count = 12) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: i === 8 ? "Francesca Campitiello" : `Giocatore ${i}` }));
  return {
    id: "regression-game", mode: "classica", players, startDealerId: "p0", status,
    rounds: [1, 2, 3].map(n => ({
      info: { index: n, cardsDealt: 7 - n, presaValue: 5 * n, rispettoValue: 10 * n, dealerId: `p${n - 1}`, biddingOrder: players.map(p => p.id) },
      results: players.map((p, i) => ({ playerId: p.id, bid: 0, respected: i === 0, scarto: i === 0 ? 0 : 1, score: i === 0 ? 10 * n : -5 * n })),
    })),
    pendingCardsDealt: 3, pendingBids: players.map(p => ({ playerId: p.id, bid: 0 })),
    pendingResultDrafts: [], saveToAlbo: false, leaderboardId: "", leaderboardName: "",
    createdAt: "2026-10-15T10:00:00Z", finishedAt: null,
  };
}

async function seedGame(page: Page, game = fixtureGame()) {
  await page.addInitScript(game => {
    if (!localStorage.getItem("taotl:active-game:v1")) localStorage.setItem("taotl:active-game:v1", JSON.stringify(game));
    localStorage.setItem("taotl:account-prompt-seen:v1", "yes");
  }, game);
}

test("credenziali errate: messaggio visibile anche quando il server cita email", async ({ page }) => {
  await page.route("**/taotl/auth/login/", route => route.fulfill({ status: 401, json: { message: "Email o password non corretti" } }));
  await page.goto("/account?mode=login");
  await page.getByPlaceholder("email@example.com oppure marco21").fill("test@example.test");
  // In accesso anche una password che non supera i criteri di registrazione va inviata.
  await page.getByPlaceholder("••••••••", { exact: true }).fill("sbagliata");
  await page.getByRole("button", { name: "Accedi al Taotl ID", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email/Taotl ID o password non corretti. Riprova." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accedi al Taotl ID", exact: true })).toBeEnabled();
});

test("turno avanzato: nomi su due righe e nessun salto dopo classifica, chiamate ed esiti", async ({ page }) => {
  await seedGame(page);
  await page.goto("/game/bids");
  const name = page.getByLabel("Francesca Campitiello", { exact: true });
  await name.scrollIntoViewIfNeeded();
  await expect.poll(() => name.evaluate(el => {
    const css = getComputedStyle(el);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    return ctx.measureText("Campitiello").width <= el.clientWidth + 1;
  })).toBe(true);
  await expect(name).toHaveCSS("-webkit-line-clamp", "2");
  await page.getByText("Classifica", { exact: true }).click();
  await page.getByRole("button", { name: /^Turno 4/ }).click();

  async function clickWithoutJump(locator: ReturnType<Page["getByRole"]>) {
    await locator.scrollIntoViewIfNeeded();
    const scroll = await locator.evaluateHandle(el => {
      let node = el.parentElement;
      while (node && !(node.scrollHeight > node.clientHeight && ["auto", "scroll"].includes(getComputedStyle(node).overflowY))) node = node.parentElement;
      return node!;
    });
    const before = await scroll.evaluate(el => el.scrollTop);
    expect(before).toBeGreaterThan(50);
    await locator.click();
    // Attende anche navigazioni innescate dagli effetti dopo l'aggiornamento del draft.
    await page.waitForTimeout(200);
    expect(await scroll.evaluate(el => el.isConnected)).toBe(true);
    // Se sparisce il controllo dello scarto, il fondo della lista può accorciarsi.
    const after = await scroll.evaluate(el => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
    expect(Math.abs(after.top - Math.min(before, after.max))).toBeLessThan(4);
    await scroll.dispose();
  }
  await clickWithoutJump(page.getByRole("button", { name: "Aumenta", exact: true }).last());
  await clickWithoutJump(page.getByRole("button", { name: "Diminuisci", exact: true }).last());
  await page.getByRole("button", { name: /Registra gli esiti/ }).click();
  await clickWithoutJump(page.getByText("Sbagliata", { exact: true }).last());
  await clickWithoutJump(page.getByRole("button", { name: "Aumenta", exact: true }).last());
  await clickWithoutJump(page.getByRole("button", { name: "Diminuisci", exact: true }).last());
  await clickWithoutJump(page.getByText("Rispettata", { exact: true }).last());
  await expect.poll(async () => (await activeGame(page))?.pendingResultDrafts?.at(-1)?.respected).toBe(true);
});

for (const destination of ["private", "leaderboard", "offline"] as const) {
  test(`salvataggio ${destination} con account e classifica selezionata`, async ({ page }) => {
    const game = { ...fixtureGame("finished", 3), saveToAlbo: true, leaderboardId: "test-board", leaderboardName: "Classifica Test" };
    const account = { id: "test-user", handle: "test_user", displayName: "Utente Test", email: "test@example.test", isAdmin: false, leaderboards: [], defaultLeaderboardId: null };
    await seedGame(page, game);
    await page.addInitScript(account => {
      localStorage.setItem("taotl.auth-session.v1", "test-session");
      localStorage.setItem("taotl.account-cache.v1", JSON.stringify(account));
    }, account);
    await page.route("**/taotl/auth/me/", route => route.fulfill({ json: account }));
    const payloads: { leaderboardId: string | null }[] = [];
    await page.route("**/taotl/games/", route => {
      if (route.request().method() !== "POST") return route.fulfill({ json: [] });
      payloads.push(route.request().postDataJSON());
      return destination === "offline" ? route.abort() : route.fulfill({ json: {} });
    });
    await page.goto("/game/end");
    await expect(page.getByRole("button", { name: "Salva senza classifica", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salva in Classifica Test", exact: true })).toBeVisible();
    await page.getByRole("button", { name: destination === "leaderboard" ? "Salva in Classifica Test" : "Salva senza classifica", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].leaderboardId).toBe(destination === "leaderboard" ? "test-board" : null);
    if (destination === "offline") {
      const pending = await page.evaluate(() => JSON.parse(localStorage.getItem("taotl:pending-sync-games:v1") || "[]"));
      expect(pending).toHaveLength(1);
      expect(pending[0].leaderboardId).toBeNull();
    }
  });
}

test("dettagli: classifica cumulativa diversa per ciascun turno", async ({ page }) => {
  const players = ["Anna", "Bruno", "Carla"].map((name, i) => ({ id: `p${i}`, name, seatOrder: i }));
  const scores = [[100, 20, 30], [-10, 30, 20], [-100, 60, 0]];
  const detail = {
    id: "ranking-fixture", mode: "classica", numPlayers: 3, startDealerId: "p0", startedAt: "2026-10-15T10:00:00Z", endedAt: "2026-10-15T11:00:00Z",
    players, standings: [1, 2, 0].map(i => ({ playerId: `p${i}`, name: players[i].name, total: scores.reduce((sum, round) => sum + round[i], 0) })),
    rounds: scores.map((round, i) => ({ index: i + 1, cardsDealt: 24 - i, presaValue: 5 * (i + 1), rispettoValue: 10 * (i + 1), dealerId: "p0", results: round.map((score, j) => ({ playerId: `p${j}`, name: players[j].name, bid: 0, respected: score >= 0, scarto: 1, score })) })),
  };
  await page.addInitScript(detail => {
    localStorage.setItem("taotl:roster-cache:v1:history-details", JSON.stringify({ [detail.id]: detail }));
  }, detail);
  await page.goto("/history/ranking-fixture");
  for (const [index, names] of [[1, ["Anna", "Carla", "Bruno"]], [2, ["Anna", "Bruno", "Carla"]], [3, ["Bruno", "Carla", "Anna"]]] as const) {
    const card = page.getByText(new RegExp(`^Turno ${index} ·`)).locator("..");
    await expect(card.getByText(/^(Anna|Bruno|Carla)$/)).toHaveText([...names]);
  }
});

test("tema scuro: invito iniziale e box credenziali opachi", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("taotl:app-settings:v1", JSON.stringify({ theme: "dark", language: "it" })));
  await page.goto("/");
  const guest = page.getByRole("button", { name: "Continua senza account" });
  await expect(guest).toBeVisible();
  await expect(guest.locator("..")).toHaveCSS("background-color", "rgb(36, 38, 42)");
  await guest.click();
  await page.goto("/account?mode=login");
  const card = page.getByRole("button", { name: "Accedi al Taotl ID", exact: true }).locator("..");
  await expect(card).toHaveCSS("background-color", "rgb(36, 38, 42)");
});
