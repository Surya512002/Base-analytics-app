import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// WETH on Base — should have liquidity routes
const WETH = "0x4200000000000000000000000000000000000006";

test.describe("mobile viewport flows", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("redeem page loads voucher form", async ({ page }) => {
    await page.goto(`${BASE}/redeem`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByPlaceholder(/XXXXX-XXXXX/i).or(page.getByText(/redeem|voucher|gift/i).first())
    ).toBeVisible({ timeout: 30_000 });
  });

  test("explore token page shows swap UI on mobile", async ({ page }) => {
    await page.goto(`${BASE}/explore/token/${WETH}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/you pay/i)).toBeVisible({ timeout: 45_000 });
  });
});

test.describe("API smoke", () => {
  test("health endpoint returns checks", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
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
