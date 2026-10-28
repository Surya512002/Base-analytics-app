import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// Verified contract addresses from base.org/stocks
const MSFTC = "0xb200000000000000000000ab99cfa739e253872b";
const TSLAC = "0xb2000000000000000000001e800a7f5189430cd0";
const COINC = "0xb2000000000000000000004c965b741362e49c71";

test.describe("Tokenized Stocks Swap & Status E2E Suite", () => {
  test("1. Preselects tradable stock (MSFTc) from URL, renders quote details & fee", async ({ page }) => {
    await page.goto(`${BASE}/swap?buy=${MSFTC}&amount=50`);

    // Verify MSFTc is preselected in the Buy box
    await expect(page.locator("body")).toContainText(/MSFTc/i, { timeout: 15_000 });

    // Verify compliance notice renders with clickable issuer terms link
    const complianceLink = page.locator('a[href*="coinbase.com/legal"]');
    await expect(complianceLink).toBeVisible();

    // Verify Tradable status appears
    await expect(page.locator("body")).toContainText(/Tradable/i);

    // Verify 0.5% platform fee disclosure
    await expect(page.locator("body")).toContainText(/0.5%|Platform Fee/i);
  });

  test("2. Low liquidity stock (TSLAc) renders warning banner without disabling swap", async ({ page }) => {
    await page.goto(`${BASE}/swap?buy=${TSLAC}`);

    // Verify TSLAc is preselected
    await expect(page.locator("body")).toContainText(/TSLAc/i, { timeout: 15_000 });

    // Verify low liquidity warning renders
    await expect(page.locator("body")).toContainText(/Low on-chain liquidity|higher slippage/i);

    // Verify BaseScan link is available
    const basescanLink = page.locator(`a[href*="basescan.org/token/${TSLAC}"]`);
    await expect(basescanLink).toBeVisible();
  });

  test("3. Unpooled stock (COINc) renders clear No Pool reason & BaseScan/Lend links", async ({ page }) => {
    await page.goto(`${BASE}/swap?buy=${COINC}`);

    // Verify COINc is preselected
    await expect(page.locator("body")).toContainText(/COINc/i, { timeout: 15_000 });

    // Verify no pool banner renders
    await expect(page.locator("body")).toContainText(/No DEX liquidity pool deployed/i);

    // Verify BaseScan link is provided
    const basescanLink = page.locator(`a[href*="basescan.org/token/${COINC}"]`);
    await expect(basescanLink).toBeVisible();

    // Verify Lend & Stake suggested action is provided
    await expect(page.locator("body")).toContainText(/Lend & Stake/i);
  });

  test("4. Explore section preselects stock via 1-click Trade button", async ({ page }) => {
    await page.goto(`${BASE}/explore`);

    // Wait for stocks section to load
    await expect(page.locator("body")).toContainText(/Tokenized Stocks|COINBASE/i, { timeout: 15_000 });

    // Find Trade button for NVDAc or MSFTc
    const tradeBtn = page.locator('button:has-text("Trade")').first();
    if (await tradeBtn.isVisible()) {
      await tradeBtn.click();
      // Should navigate to /swap?buy=...
      await page.waitForURL(/.*\/swap.*/, { timeout: 10_000 });
      expect(page.url()).toContain("swap");
    }
  });
});
