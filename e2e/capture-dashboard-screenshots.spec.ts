import { test, expect } from "@playwright/test";

/** Prefer local server in CI; production only for manual asset regeneration. */
const BASE =
  process.env.SCREENSHOT_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "https://base-analytics-app.vercel.app";
const VIEWPORT = { width: 1284, height: 2778 };
const WETH = "0x4200000000000000000000000000000000000006";

const chromePath = process.env.CHROME_PATH?.trim();

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
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
      localStorage.setItem("base_onboarding_done_v6", "1");
      localStorage.setItem("base_onboarding_done_v5", "1");
    });
  });

  test("capture 1284x2778 listing screenshots", async ({ page }) => {
    test.setTimeout(180_000);

    // 1 — Explore / B20 launchpad
    await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(
      page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first()
    ).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: "public/screenshots/screenshot-1-connect.png",
      fullPage: false,
    });

    // 2 — In-app swap (recent USD pricing UI)
    await page.goto(`${BASE}/explore/token/${WETH}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expect(page.getByText("Sell", { exact: true })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(3500);
    await page.screenshot({
      path: "public/screenshots/screenshot-2-dashboard.png",
      fullPage: false,
    });

    // 3 — Base Voucher redeem
    await page.goto(`${BASE}/redeem`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(
      page.getByPlaceholder(/XXXXX-XXXXX/i).or(page.getByText(/redeem|voucher|gift/i).first())
    ).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "public/screenshots/screenshot-3-voucher.png",
      fullPage: false,
    });
  });
});
