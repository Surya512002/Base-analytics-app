import { test, expect } from "@playwright/test";

/** Prefer local server in CI; production only for manual asset regeneration. */
const BASE =
  process.env.SCREENSHOT_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "https://base-analytics-app.vercel.app";
// A phone at 3x, saved as 1284x2778 images.
const VIEWPORT = { width: 428, height: 926 };

const chromePath = process.env.CHROME_PATH?.trim();

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 3,
  colorScheme: "dark",
  ...(chromePath
    ? { launchOptions: { executablePath: chromePath } }
    : {}),
});

test.describe("Base dashboard screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("base_pin_banner_dismissed_v1", "1");
      localStorage.setItem("base_explore_onboarding_v1", "1");
      localStorage.setItem("base_onboarding_done_v5", "1");
    });
  });

  test("capture 1284x2778 listing screenshots", async ({ page }) => {
    test.setTimeout(180_000);

    // The three real screens people start from; nothing staged.
    for (const [path, file] of [
      ["/", "screenshot-1-connect.png"],
      ["/lend", "screenshot-2-dashboard.png"],
      ["/redeem", "screenshot-3-voucher.png"],
    ]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expect(page.locator("h1, h2").first()).toBeAttached({ timeout: 45_000 });
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `public/screenshots/${file}`, fullPage: false });
    }
  });
});
