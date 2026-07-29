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
    await expect(page.getByText("Sell", { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Buy", { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("explore shows guest banner and connect on mobile", async ({ page }) => {
    await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/browsing as guest/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /connect/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("creator profile page loads on mobile", async ({ page }) => {
    const addr = "0x0000000000000000000000000000000000000001";
    await page.goto(`${BASE}/creator/${addr}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Creator profile")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("navigation", { name: "Main" }).getByText("Profile")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("navigation", { name: "Main" }).getByText("Quests")).toBeVisible();
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
