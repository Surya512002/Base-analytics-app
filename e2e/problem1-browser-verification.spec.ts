import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const SCREENSHOT_DIR = path.resolve(process.cwd(), "limit-orders/logs/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const DUMMY_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

interface TestScenario {
  chainHex: "0x14a34" | "0x2105";
  chainName: "sepolia" | "mainnet";
  country: "IN" | "US";
  isRestricted: boolean;
  viewportWidth: 1280 | 360;
  viewportHeight: number;
}

const SCENARIOS: TestScenario[] = [
  // Desktop 1280px scenarios
  { chainHex: "0x14a34", chainName: "sepolia", country: "IN", isRestricted: false, viewportWidth: 1280, viewportHeight: 900 },
  { chainHex: "0x2105", chainName: "mainnet", country: "IN", isRestricted: false, viewportWidth: 1280, viewportHeight: 900 },
  { chainHex: "0x14a34", chainName: "sepolia", country: "US", isRestricted: true, viewportWidth: 1280, viewportHeight: 900 },
  { chainHex: "0x2105", chainName: "mainnet", country: "US", isRestricted: true, viewportWidth: 1280, viewportHeight: 900 },

  // Mobile 360px scenarios
  { chainHex: "0x14a34", chainName: "sepolia", country: "IN", isRestricted: false, viewportWidth: 360, viewportHeight: 740 },
  { chainHex: "0x2105", chainName: "mainnet", country: "IN", isRestricted: false, viewportWidth: 360, viewportHeight: 740 },
  { chainHex: "0x14a34", chainName: "sepolia", country: "US", isRestricted: true, viewportWidth: 360, viewportHeight: 740 },
  { chainHex: "0x2105", chainName: "mainnet", country: "US", isRestricted: true, viewportWidth: 360, viewportHeight: 740 },
];

test.describe("Problem 1: Real Browser Playwright Verification", () => {
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1000);
  });

  for (const scenario of SCENARIOS) {
    const testName = `${scenario.chainName.toUpperCase()} (${scenario.chainHex}) | ${scenario.viewportWidth}px | Country: ${scenario.country}`;

    test(testName, async ({ page }) => {
      test.setTimeout(60000);
      const consoleLogs: string[] = [];
      page.on("console", (msg) => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      });
      page.on("pageerror", (err) => {
        consoleLogs.push(`[pageerror] ${err.message}`);
      });

      await page.setExtraHTTPHeaders({ Connection: "close" });
      await page.setViewportSize({ width: scenario.viewportWidth, height: scenario.viewportHeight });

      // 1. Mock the region check and background APIs
      await page.route("**/api/limit-orders/region-check", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            restricted: scenario.isRestricted,
            country: scenario.country,
          }),
        });
      });
      await page.route("**/api/app/unique-users", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uniqueUsers: 100 }) });
      });

      // 2. Stub window.ethereum EIP-1193 provider & pre-seed localStorage
      await page.addInitScript(
        ({ chainHex, address }) => {
          try {
            localStorage.clear();
            localStorage.setItem("base_onboarding_done_v7", "1");
          } catch {}
          const listeners: Record<string, Function[]> = {};
          (window as any).ethereum = {
            isMetaMask: true,
            chainId: chainHex,
            networkVersion: String(parseInt(chainHex, 16)),
            selectedAddress: address,
            request: async ({ method, params }: { method: string; params?: any[] }) => {
              if (method === "eth_chainId") return chainHex;
              if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
              if (method === "net_version") return String(parseInt(chainHex, 16));
              if (method === "wallet_switchEthereumChain") return null;
              if (method === "eth_blockNumber") return "0x1000000";
              if (method === "eth_getBalance") return "0x1000000000000000000";
              return null;
            },
            on: (event: string, cb: Function) => {
              listeners[event] = listeners[event] || [];
              listeners[event].push(cb);
            },
            removeListener: () => {},
          };
        },
        { chainHex: scenario.chainHex, address: DUMMY_WALLET }
      );

      // 3. Navigate to /swap and wait for hydration past loading screen
      await page.goto(`${BASE_URL}/swap`, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Wait for the app to finish loading
      const marketTab = page.locator('button:has-text("Market")');
      await marketTab.waitFor({ state: "visible", timeout: 30000 });

      const ordersTab = page.locator('button:has-text("Orders")');
      const recurringTab = page.locator('button:has-text("Recurring")');

      await expect(marketTab).toBeVisible();
      await expect(ordersTab).toBeVisible();
      await expect(recurringTab).toBeVisible();

      // Click Orders Tab
      await ordersTab.click();
      await page.waitForTimeout(1000);

      // Verify rendering according to chain and region
      if (scenario.chainName === "mainnet") {
        // Mainnet has no deployed order book yet: MUST display the clear message & switch button!
        const placeholder = page.getByText("Orders aren't live on Base mainnet yet", { exact: false });
        await expect(placeholder).toBeVisible({ timeout: 10000 });

        const switchBtn = page.locator('button:has-text("Switch to Base Sepolia")');
        await expect(switchBtn).toBeVisible();
      } else {
        // Sepolia has deployed testnet order book
        if (scenario.isRestricted) {
          // US region restriction alert must render
          const regionAlert = page.getByText("These orders aren't available in your region", { exact: false });
          await expect(regionAlert.first()).toBeVisible({ timeout: 10000 });
        } else {
          // IN non-restricted region: Order form options must render
          await expect(page.locator('button:has-text("Limit buy")')).toBeVisible({ timeout: 10000 });
          await expect(page.locator('button:has-text("Take-profit")')).toBeVisible();
          await expect(page.locator('button:has-text("Stop-loss")')).toBeVisible();
        }
      }

      // Take screenshot and save to limit-orders/logs/screenshots/
      const screenshotFilename = `orders-${scenario.chainName}-${scenario.viewportWidth}px-${scenario.country}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Also click Recurring Tab and verify
      await recurringTab.click();
      await page.waitForTimeout(1000);

      if (scenario.chainName === "mainnet") {
        const recurringPlaceholder = page.getByText("Recurring buys aren't live on Base mainnet yet", { exact: false });
        await expect(recurringPlaceholder).toBeVisible({ timeout: 10000 });
      }

      const recurringScreenshot = path.join(SCREENSHOT_DIR, `recurring-${scenario.chainName}-${scenario.viewportWidth}px-${scenario.country}.png`);
      await page.screenshot({ path: recurringScreenshot, fullPage: true });

      // Verify zero CSP violations in browser console
      const cspViolations = consoleLogs.filter((log) =>
        /Content Security Policy|violates the following Content Security Policy directive/i.test(log)
      );
      expect(cspViolations).toEqual([]);
    });
  }
});
