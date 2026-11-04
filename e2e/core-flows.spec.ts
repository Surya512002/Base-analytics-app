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

  test("6. i18n Language Switcher: opens language selector and renders localized labels", async ({ page }) => {
    await page.goto("/");
    const langButton = page.getByRole("button", { name: /select language/i }).first();
    await expect(langButton).toBeVisible();
    await langButton.click();

    // Verify language choices are shown
    await expect(page.getByText("Español")).toBeVisible();
    await expect(page.getByText("हिन्दी")).toBeVisible();
    await expect(page.getByText("தமிழ்")).toBeVisible();
  });

  test("7. Liquidation Guard: renders liquidation banner and opens what-if collateral drop slider", async ({ page }) => {
    await page.goto("/?tab=lend");
    await expect(page.getByText(/Liquidation Guard/i).first()).toBeVisible();

    // Open What-If Simulator
    const simButton = page.getByRole("button", { name: /simulate drop/i }).first();
    await expect(simButton).toBeVisible();
    await simButton.click();

    // Verify slider and stress test panel appear
    await expect(page.getByText(/What-If Stress Test/i)).toBeVisible();
    await expect(page.getByText(/Projected Health Factor/i)).toBeVisible();
  });

  test("8. Smart Money Radar: renders live onchain feed and wallet follower on Explore", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByText(/Smart Money Radar/i)).toBeVisible();
    await expect(page.getByText(/Follow Wallet/i)).toBeVisible();
    await expect(page.getByText(/vitalik\.eth/i)).toBeVisible();
  });

  test("9. Portfolio Time Machine: opens holdings drawer and renders historical benchmark", async ({ page }) => {
    await page.goto("/swap");
    const holdingsBtn = page.getByRole("button", { name: /portfolio|holdings/i }).first();
    if (await holdingsBtn.isVisible()) {
      await holdingsBtn.click();
      await expect(page.getByText(/Portfolio Time Machine/i)).toBeVisible();
      await expect(page.getByText(/Export Tax CSV/i)).toBeVisible();
    }
  });

  test("10. Yield Finder: renders multi-protocol scanner and risk tier filters on Lend", async ({ page }) => {
    await page.goto("/?tab=lend");
    await expect(page.getByText(/Yield Finder/i).first()).toBeVisible();
    await expect(page.getByText(/Multi-Protocol Scanner/i).first()).toBeVisible();

    // Verify filter buttons
    await expect(page.getByRole("button", { name: "All Assets" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Low Risk" }).first()).toBeVisible();
  });

  test("11. Stock NAV Tracker: renders 24/5 vs 24/7 spread tracker and market hours indicator", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByText(/Stock NAV Tracker/i).first()).toBeVisible();
    await expect(page.getByText(/Market Open|Market Closed/i).first()).toBeVisible();
    await expect(page.getByText(/Custody Attestations/i).first()).toBeVisible();
  });

  test("12. Smarter Alerts: renders multi-trigger alert panel on Explore", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByText(/Smarter Alerts/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /new alert/i }).first()).toBeVisible();
  });
});
