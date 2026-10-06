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
