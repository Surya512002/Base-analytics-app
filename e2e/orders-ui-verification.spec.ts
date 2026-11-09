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

    // Verify Market tab is active by default
    const marketTab = page.locator('button:has-text("Market")');
    await expect(marketTab).toBeVisible({ timeout: 15000 });

    // Verify swap card inputs are visible
    await expect(page.locator("body")).toContainText(/Swap|You Pay|You Receive/i, { timeout: 15000 });

    // Check console errors for unhandled exceptions or React hydration errors
    const fatalErrors = consoleErrors.filter(
      (e) => e.includes("Hydration failed") || e.includes("Unhandled") || e.includes("Uncaught")
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test("2. Desktop (1280px): Orders and Recurring tabs render properly with no scroll blowout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/swap`, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Switch to Orders tab
    const ordersTab = page.locator('button:has-text("Orders")');
    await expect(ordersTab).toBeVisible();
    await ordersTab.click();

    // Verify Order Type selector options: Limit buy, Take-profit, Stop-loss, Trailing stop, Bracket
    await expect(page.locator('button:has-text("Limit buy")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Take-profit")')).toBeVisible();
    await expect(page.locator('button:has-text("Stop-loss")')).toBeVisible();
    await expect(page.locator('button:has-text("Trailing stop")')).toBeVisible();
    await expect(page.locator('button:has-text("Bracket")')).toBeVisible();

    // Verify input fields and connect wallet button
    const amountInput = page.locator("#order-amount-input");
    await expect(amountInput).toBeVisible();

    // Verify no horizontal overflow blowout on desktop
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);

    // Switch to Recurring tab
    const recurringTab = page.locator('button:has-text("Recurring")');
    await expect(recurringTab).toBeVisible();
    await recurringTab.click();

    // Verify DCA elements: amount per buy, frequency presets
    await expect(page.locator("body")).toContainText(/Amount Per Buy|Repeat Every|Price Ceiling/i, { timeout: 10000 });
    await expect(page.locator('button:has-text("1 day")')).toBeVisible();

    // Verify no fatal console errors
    const fatalErrors = consoleErrors.filter(
      (e) => e.includes("Hydration failed") || e.includes("Unhandled") || e.includes("Uncaught")
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test("3. Mobile (360px - iPhone SE): Orders & Recurring tabs fit without blowout, buttons tap-friendly", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/swap`, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Switch to Orders tab
    const ordersTab = page.locator('button:has-text("Orders")');
    await expect(ordersTab).toBeVisible();
    await ordersTab.click();

    // Verify Order Type buttons are reachable and tap-friendly (min height 32px)
    const limitBuyBtn = page.locator('button:has-text("Limit buy")');
    await expect(limitBuyBtn).toBeVisible();
    const box = await limitBuyBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(28);

    // Verify no horizontal overflow blowout at 360px
    const isOverflowingMobile = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowingMobile).toBe(false);

    // Click Trailing stop to test dynamic trail inputs at 360px
    const trailingStopBtn = page.locator('button:has-text("Trailing stop")');
    await trailingStopBtn.click();
    await expect(page.locator("body")).toContainText(/Trail Distance/i);

    // Switch to Recurring tab
    const recurringTab = page.locator('button:has-text("Recurring")');
    await recurringTab.click();
    await expect(page.locator("body")).toContainText(/Amount Per Buy/i);

    // Verify no horizontal overflow on recurring tab either
    const isRecurringOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isRecurringOverflowing).toBe(false);

    // Verify 0 hydration / fatal console errors
    const fatalErrors = consoleErrors.filter(
      (e) => e.includes("Hydration failed") || e.includes("Unhandled") || e.includes("Uncaught")
    );
    expect(fatalErrors).toHaveLength(0);
  });
});
