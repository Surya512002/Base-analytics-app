import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("guest browse flow", () => {
  test("explore page loads and shows search", async ({ page }) => {
    await page.goto(`${BASE}/explore`);
    await expect(page.getByRole("heading", { name: /explore|launchpad|base/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    const search = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await expect(search).toBeVisible({ timeout: 15_000 });
  });

  test("home shows connect CTA for guests", async ({ page }) => {
    await page.goto(BASE);
    await expect(
      page.getByText(/connect|guest|browse/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("wallet profile public page loads", async ({ page }) => {
    test.setTimeout(120_000);
    const demo = "0x3799cafa388da047caf7c999e31c844705fadfae";
    await page.goto(`${BASE}/wallet/${demo}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expect(page.getByText(/public profile|onchain score|wallet/i).first()).toBeVisible({
      timeout: 45_000,
    });
  });
});
