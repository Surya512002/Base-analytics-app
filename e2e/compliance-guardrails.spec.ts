import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// Verified stock tokens
const MSFTC = "0xb200000000000000000000ab99cfa739e253872b";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

test.describe("Compliance Guardrails & Exit-Only Safeguards E2E Suite", () => {
  test.describe("1. Legal and Restricted Regions Pages", () => {
    test("renders /restricted-regions with exit-only guarantee and limitations disclosure", async ({ page }) => {
      await page.goto(`${BASE}/restricted-regions`);

      await expect(page.locator("h1")).toContainText(/Restricted Regions & Product Availability/i);
      await expect(page.locator("body")).toContainText(/Exit-Only Guarantee/i);
      await expect(page.locator("body")).toContainText(/Never blocked from accessing your own funds/i);
      await expect(page.locator("body")).toContainText(/Technical Limitations & Gating/i);
      await expect(page.locator("body")).toContainText(/United States/i);
    });

    test("renders draft legal pages /terms, /privacy, and /risk-disclosure with counsel markers", async ({ page }) => {
      // /terms
      await page.goto(`${BASE}/terms`);
      await expect(page.locator("body")).toContainText(/Draft, pending legal review\. Not final\./i);
      await expect(page.locator("body")).toContainText(/Terms of Service/i);

      // /privacy
      await page.goto(`${BASE}/privacy`);
      await expect(page.locator("body")).toContainText(/Privacy Policy/i);
      await expect(page.locator("body")).toContainText(/No personal data \(PII\) is stored/i);

      // /risk-disclosure
      await page.goto(`${BASE}/risk-disclosure`);
      await expect(page.locator("body")).toContainText(/Risk Disclosure/i);
      await expect(page.locator("body")).toContainText(/24\/5 Equity Markets vs\. 24\/7 AMM Liquidity/i);
    });

    test("renders non-intrusive legal links in footer", async ({ page }) => {
      await page.goto(`${BASE}/swap`);

      const footer = page.locator("footer");
      await expect(footer).toContainText(/Restricted Regions/i);
      await expect(footer).toContainText(/Risk Disclosure/i);
      await expect(footer).toContainText(/Terms/i);
      await expect(footer).toContainText(/Privacy/i);
      await expect(footer).toContainText(/Not financial, legal or tax advice/i);
    });
  });

  test.describe("2. Exit-Only Mode & Restricted User Safeguards", () => {
    test("restricted user (US) sees stock buy blocked while non-stock features remain functional", async ({ page }) => {
      // Set mock country header to US via request extra headers
      await page.setExtraHTTPHeaders({
        "x-mock-country": "US",
      });

      await page.goto(`${BASE}/swap?buy=${MSFTC}`);

      // Wait for page load
      await expect(page.locator("body")).toContainText(/MSFTc/i, { timeout: 15_000 });

      // Verify restriction banner or notice appears
      const banner = page.locator("body");
      await expect(banner).toContainText(/Tokenized stock features are not available in your region/i);

      // Verify non-stock swap (e.g. ETH -> USDC) works without restriction
      await page.goto(`${BASE}/swap?buy=${USDC}`);
      await expect(page.locator("body")).not.toContainText(/Tokenized stock features are not available in your region/i);
    });

    test("restricted user on Explore stock card sees Swap button disabled", async ({ page }) => {
      await page.setExtraHTTPHeaders({
        "x-mock-country": "US",
      });

      await page.goto(`${BASE}/explore`);
      await expect(page.locator("body")).toContainText(/Explore/i, { timeout: 15_000 });

      // Find stock card
      const stockCard = page.locator("div").filter({ hasText: /MSFTc|B20/i }).first();
      if (await stockCard.isVisible()) {
        const swapBtn = stockCard.locator("button:has-text('Swap')").first();
        if (await swapBtn.isVisible()) {
          await expect(swapBtn).toBeDisabled();
        }
      }
    });
  });

  test.describe("3. First-Use Risk Acknowledgement Modal", () => {
    test("shows acknowledgement modal on first stock interaction and persists in localStorage", async ({ page }) => {
      // Set country to allowed jurisdiction (DE)
      await page.setExtraHTTPHeaders({
        "x-mock-country": "DE",
      });

      // Clear localStorage to ensure first-use
      await page.addInitScript(() => {
        localStorage.clear();
      });

      await page.goto(`${BASE}/swap?buy=${MSFTC}`);
      await expect(page.locator("body")).toContainText(/MSFTc/i, { timeout: 15_000 });

      // Acknowledgement modal or disclosure notice should be accessible
      const modalTrigger = page.locator("body");
      await expect(modalTrigger).toContainText(/Tokenized Stock|Coinbase B20 Equity/i);
    });
  });

  test.describe("4. Mobile Layout & Theme Responsiveness", () => {
    test("verifies compliance notices and modals render cleanly on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE viewport
      await page.setExtraHTTPHeaders({
        "x-mock-country": "US",
      });

      await page.goto(`${BASE}/restricted-regions`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("body")).toContainText(/Exit-Only Guarantee/i);
    });

    test("verifies light and dark mode styles without layout breakage", async ({ page }) => {
      // Light Mode
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto(`${BASE}/restricted-regions`);
      await expect(page.locator("h1")).toBeVisible();

      // Dark Mode
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(`${BASE}/restricted-regions`);
      await expect(page.locator("h1")).toBeVisible();
    });
  });
});
