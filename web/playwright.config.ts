import { defineConfig, devices } from "@playwright/test";

const deployedURL = process.env.TAOTL_WEB_TEST_URL;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: "list",
  outputDir: "../test-results/web",
  use: {
    actionTimeout: 10_000,
    baseURL: deployedURL || "http://127.0.0.1:8097",
    locale: "it-IT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: deployedURL ? undefined : {
    command: "node web/serve.mjs",
    cwd: "..",
    env: { PORT: "8097" },
    url: "http://127.0.0.1:8097",
    reuseExistingServer: false,
  },
});
