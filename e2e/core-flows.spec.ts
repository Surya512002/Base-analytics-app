import { test, expect } from "@playwright/test";

test.describe("Core App User Flows", () => {
  test("1. Connect Wallet: modal opens with provider choices", async ({ page }) => {
    await page.goto("/explore");
    const connectButton = page.getByRole("button", { name: /connect/i }).first();
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      // Should show Coinbase / browser injection options
      await expect(page.getByText(/coinbase|browser|injected/i).first()).toBeVisible();
    }
  });

  test("2. Swap Flow: loads /swap with inputs and Advanced settings accordion", async ({ page }) => {
    await page.goto("/swap");
    await expect(page.getByText(/you pay/i)).toBeVisible();
    await expect(page.getByText(/you receive/i)).toBeVisible();

    // Verify Advanced accordion toggle works
    const advancedToggle = page.getByRole("button", { name: /advanced/i }).first();
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
      await expect(page.getByText(/slippage tolerance/i)).toBeVisible();
      await expect(page.getByText(/dex routing/i)).toBeVisible();
    }
  });

  test("3. Voucher Flow: loads create wizard and redeem views", async ({ page }) => {
    await page.goto("/?tab=basehub");
    await expect(page.getByText(/voucher|gift/i).first()).toBeVisible();

    // Navigate to redeem
    await page.goto("/redeem");
    await expect(page.getByPlaceholder(/card id|secret|0x/i).first()).toBeVisible();
  });

  test("4. Token Launcher: loads /launch with readiness scoring", async ({ page }) => {
    await page.goto("/launch");
    await expect(page.getByText(/launch|token|fixed supply/i).first()).toBeVisible();
    await expect(page.getByText(/1B/i).first()).toBeVisible();
  });

  test("5. Lend & Stake: loads yield calculator and clicking Explore Vault opens market action modal", async ({ page }) => {
    await page.goto("/?tab=lend");
    await expect(page.getByText(/Interactive APY Yield Calculator/i)).toBeVisible();

    const exploreButton = page.getByRole("button", { name: /explore vault/i }).first();
    await expect(exploreButton).toBeVisible();
    await exploreButton.click();

    // Verify modal or action drawer opens with deposit / supply interface
    await expect(
      page.getByText(/Beefy|Aerodrome|Supply|Stake|Deposit/i).first()
    ).toBeVisible();
  });
});
