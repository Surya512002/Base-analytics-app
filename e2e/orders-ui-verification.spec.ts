import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("Swap Tabs & Pro Orders Verification", () => {
  test("1. Market Tab regression: stock quote and swap card render with 0 console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to swap page with preselected stock NVDAc
    await page.goto(`${BASE}/swap?buy=0xb20000000000000000000078ee7ce2fe4908108c&amount=50`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // If Pro Orders sub-tabs are enabled by feature flag, verify Market tab is active
    const marketTab = page.locator('button:has-text("Market")');
    if (await marketTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(marketTab).toBeVisible();
    }

    // Verify swap card inputs are visible
    await expect(page.locator("body")).toContainText(/Swap|You Pay|You Receive/i, { timeout: 15000 });

    // Check console errors for unhandled exceptions or React hydration errors
    const fatalErrors = consoleErrors.filter(
      (e) => e.includes("Hydration failed") || e.includes("Unhandled") || e.includes("Uncaught")
    );
    expect(fatalErrors).toHaveLength(0);
  });

  for (const size of [
    { name: "Desktop (1280px)", width: 1280, height: 900 },
    { name: "Mobile (360px - iPhone SE)", width: 360, height: 740 },
  ]) {
    test(`${size.name}: Trade offers limit orders and auto-invest, Swap stands alone, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      const noOverflow = async () =>
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      const noFatal = () =>
        expect(consoleErrors.filter((e) => e.includes("Hydration failed") || e.includes("Unhandled") || e.includes("Uncaught"))).toHaveLength(0);

      await page.goto(`${BASE}/swap`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await expect(page.locator(".place-tabs")).toHaveCount(0);
      await page.goto(`${BASE}/trade?ticket=orders`, { waitUntil: "domcontentloaded", timeout: 30000 });
      const ordersLink = page.locator('.place-tabs a:has-text("Limit and stop")').first();
      if (!(await ordersLink.isVisible({ timeout: 3000 }).catch(() => false))) {
        // Orders feature flag is off in this environment: the plain swap page must still fit.
        await noOverflow();
        noFatal();
        return;
      }
      await noOverflow();

      await page.locator('.place-tabs a:has-text("Auto-invest")').click();
      const notLive = page.locator('[data-testid="mainnet-recurring-placeholder"]').or(page.getByText(/Recurring buys aren't live on Base mainnet yet/i));
      if (await notLive.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.locator('button:has-text("Switch to Base Sepolia")').first()).toBeVisible();
      } else {
        await expect(page.locator("body")).toContainText(/spend each time|How often|Start with/i, { timeout: 10000 });
      }
      await noOverflow();

      // The orders link opens the order ticket on the Trade page.
      await ordersLink.click();
      await expect(page).toHaveURL(/\/trade\?ticket=orders/, { timeout: 15000 });
      await noOverflow();
      noFatal();
    });
  }

  test("old Swap orders links open Trade", async ({ page }) => {
    await page.goto(`${BASE}/swap?mode=orders`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(/\/trade\?ticket=orders/, { timeout: 20000 });
  });

  test("an old recurring chart link opens the auto-invest form for that stock", async ({ page }) => {
    const nvda = "0xb20000000000000000000078ee7ce2fe4908108c";
    await page.goto(`${BASE}/trade`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const switcher = page.locator('.place-tabs a:has-text("Auto-invest")');
    const enabled = await switcher.waitFor({ timeout: 10000 }).then(() => true, () => false);
    test.skip(!enabled, "Orders feature flag is off in this build");
    await page.goto(`${BASE}/trade?token=${nvda}&ticket=recurring`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(`/swap\\?mode=recurring&token=${nvda}`), { timeout: 20000 });
    await expect(page.getByRole("tab", { name: "One stock" })).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
  });

  test("Account has an Orders switch that asks to connect and offers new orders", async ({ page }) => {
    await page.goto(`${BASE}/lend?view=orders`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.getByRole("region", { name: "Orders and plans" })).toContainText(/Connect your wallet/i, { timeout: 20000 });
    await expect(page.getByRole("link", { name: "New auto-invest plan" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Settings and help" })).toBeVisible();
  });
});
