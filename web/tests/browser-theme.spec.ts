import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context, baseURL }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === baseURL || !url.protocol.startsWith("http") ? route.continue() : route.abort();
  });
});

for (const preference of ["dark", "light", "system"] as const) {
  test(`barra browser: tema ${preference} applicato prima del caricamento dell'app`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(preference => localStorage.setItem("taotl:app-settings:v1", JSON.stringify({ theme: preference })), preference);
    // Riproduce l'avvio lento: il tema deve essere corretto anche prima di React/font.
    await page.route("**/_expo/**", route => route.abort());
    await page.goto("/account?mode=login", { waitUntil: "domcontentloaded" });
    const dark = preference !== "light";
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", dark ? "#16171B" : "#F8F8F5");
    await expect(page.locator("html")).toHaveCSS("background-color", dark ? "rgb(22, 23, 27)" : "rgb(248, 248, 245)");
    await expect(page.locator("body")).toHaveCSS("background-color", dark ? "rgb(22, 23, 27)" : "rgb(248, 248, 245)");
  });
}

test("barra browser: segue cambio tema, sistema e schermata", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const admin = { id: "theme-admin", handle: "theme_admin", displayName: "Admin Test", email: "admin@example.test", isAdmin: true, leaderboards: [], defaultLeaderboardId: null };
  await page.addInitScript(admin => {
    localStorage.setItem("taotl.auth-session.v1", "theme-session");
    localStorage.setItem("taotl.account-cache.v1", JSON.stringify(admin));
    localStorage.setItem("taotl:account-prompt-seen:v1", "yes");
  }, admin);
  await context.route("**/taotl/auth/me/", route => route.fulfill({ json: admin }));
  await context.route("**/taotl/leaderboards/", route => route.fulfill({ json: [] }));
  // L'admin verifica l'accesso e apre prima il proprio pannello.
  await page.goto("/account?mode=login");
  const isAdmin = await page.locator("html").getAttribute("data-taotl-admin");
  if (isAdmin) {
    await expect(page).toHaveURL(/\/admin$/);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#16171B");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(22, 23, 27)");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#F8F8F5");
    return;
  }
  else await expect(page.getByText("Admin Test", { exact: true }).first()).toBeVisible();
  await page.goto("/settings");
  await page.getByText("Scuro", { exact: true }).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#16171B");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(22, 23, 27)");
  await page.reload();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#16171B");
  await page.getByText("Chiaro", { exact: true }).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#F8F8F5");
  await page.getByRole("radio", { name: "Dispositivo", exact: true }).first().click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#16171B");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#F8F8F5");
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", isAdmin ? "#F8F8F5" : "#17784B");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#125C3B");
});
