import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  /** Marketing asset capture — run via `npm run screenshots:dashboard` only. */
  testIgnore: ["**/capture-dashboard-screenshots.spec.ts"],
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/capture-dashboard-screenshots.spec.ts", "**/mobile-*.spec.ts"],
    },
    {
      name: "mobile-iphone-14",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
      },
      testMatch: [/mobile-.*\.spec\.ts/],
    },
    {
      name: "mobile-pixel-7",
      use: {
        ...devices["Pixel 7"],
      },
      testMatch: [/mobile-.*\.spec\.ts/],
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
