import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// WETH on Base — should have liquidity routes
const WETH = "0x4200000000000000000000000000000000000006";

const MOBILE_VIEWPORTS = [
  { name: "320px (Ultra-compact / iPhone SE 1)", width: 320, height: 568 },
  { name: "375px (iPhone SE 2/3 / mini)", width: 375, height: 667 },
  { name: "390px (iPhone 13/14/15 standard)", width: 390, height: 844 },
  { name: "412px (Pixel 7 / Android standard)", width: 412, height: 915 },
  { name: "430px (iPhone Pro Max / Plus)", width: 430, height: 932 },
  { name: "768px (Tablet portrait / iPad)", width: 768, height: 1024 },
];

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Mobile viewport verification: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`launch page loads without horizontal scroll or picker overflow at ${vp.width}px`, async ({
      page,
    }) => {
      await page.goto(`${BASE}/launch`, { waitUntil: "domcontentloaded" });

      // Verify no horizontal page overflow (scrollWidth should equal clientWidth)
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBeFalsy();

      // Check header title or launch text is visible
      await expect(
        page.getByText(/Launch/i).first().or(page.locator("h1, h2").first())
      ).toBeVisible({ timeout: 25_000 });
    });

    test(`swap page loads without overflow at ${vp.width}px`, async ({ page }) => {
      await page.goto(`${BASE}/swap`, { waitUntil: "domcontentloaded" });
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBeFalsy();
    });

    test(`explore page loads without horizontal overflow at ${vp.width}px`, async ({ page }) => {
      await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBeFalsy();
    });

    test(`lend page loads without horizontal overflow at ${vp.width}px`, async ({ page }) => {
      await page.goto(`${BASE}/lend`, { waitUntil: "domcontentloaded" });
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBeFalsy();
    });

    test(`bottom-nav safe areas render correctly on mobile at ${vp.width}px`, async ({
      page,
    }) => {
      await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
      if (vp.width < 768) {
        const bottomNav = page.locator("nav[aria-label='Mobile navigation']");
        await expect(bottomNav).toBeVisible({ timeout: 20_000 });
        await expect(bottomNav.getByText(/Explore/i).first()).toBeVisible();
        await expect(bottomNav.getByText(/Swap/i).first()).toBeVisible();
      }
    });
  });
}

test.describe("mobile flows functional check", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("redeem page loads voucher form", async ({ page }) => {
    await page.goto(`${BASE}/redeem`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByPlaceholder(/XXXXX-XXXXX/i).or(page.getByText(/redeem|voucher|gift/i).first())
    ).toBeVisible({ timeout: 30_000 });
  });

  test("explore token page shows swap UI on mobile", async ({ page }) => {
    await page.goto(`${BASE}/explore/token/${WETH}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("You Pay (Sell)")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("You Receive (Buy Estimated)")).toBeVisible({ timeout: 15_000 });
  });

  test("explore shows guest banner and connect on mobile", async ({ page }) => {
    await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /connect/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("API smoke", () => {
  test("health endpoint returns checks", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect([200, 503]).toContain(res.status());
    const data = await res.json();
    expect(data.checks).toBeDefined();
    expect(data.checks.rpc).toBeDefined();
    expect(typeof data.ok).toBe("boolean");
  });

  test("swap quote API returns JSON", async ({ request }) => {
    const qs = new URLSearchParams({
      token: WETH,
      direction: "buy",
      amount: "0.001",
      dex: "auto",
    });
    const res = await request.get(`${BASE}/api/launchpad/quote?${qs}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty("hasLiquidity");
  });
});
