import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync, spawn } from "child_process";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "limit-orders/logs/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function run() {
  console.log("=== CASE B: Building production build with NEXT_PUBLIC_LIMIT_ORDERS_ENABLED=true and no Sepolia variables ===");
  const env = { ...process.env };
  env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED = "true";
  delete env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA;
  delete env.NEXT_PUBLIC_LIMIT_ORDER_ADAPTER_SEPOLIA;
  delete env.NEXT_PUBLIC_LIMIT_ORDER_QUOTE_SEPOLIA;
  delete env.NEXT_PUBLIC_LIMIT_ORDER_STOCK_SEPOLIA;
  delete env.NEXT_PUBLIC_LIMIT_ORDER_FEED_SEPOLIA;

  const buildRes = spawnSync("node", ["node_modules/next/dist/bin/next", "build"], {
    stdio: "inherit",
    env,
  });

  if (buildRes.status !== 0) {
    console.error("Build failed for Case B");
    process.exit(1);
  }

  console.log("Starting server on 127.0.0.1:3000...");
  const srv = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "127.0.0.1"], {
    stdio: "inherit",
    env,
  });

  await new Promise((r) => setTimeout(r, 2500));

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Stub provider on Base Sepolia (0x14a34)
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("base_onboarding_done_v7", "1");
    } catch {}
    const DUMMY_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const chainHex = "0x14a34";
    window.ethereum = {
      isMetaMask: true,
      chainId: chainHex,
      networkVersion: "84532",
      selectedAddress: DUMMY_WALLET,
      request: async ({ method }) => {
        if (method === "eth_chainId") return chainHex;
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [DUMMY_WALLET];
        if (method === "net_version") return "84532";
        if (method === "eth_blockNumber") return "0x1000000";
        if (method === "eth_getBalance") return "0x1000000000000000000";
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };
  });

  // Route mocks
  await page.route("**/api/limit-orders/region-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ restricted: false, country: "IN" }),
    });
  });
  await page.route("**/api/app/unique-users", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ uniqueUsers: 100 }),
    });
  });

  console.log("Navigating to http://127.0.0.1:3000/swap ...");
  await page.goto("http://127.0.0.1:3000/swap", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const ordersTab = page.locator('button:has-text("Orders")');
  const ordersVisible = await ordersTab.isVisible();
  console.log("Orders tab visible?", ordersVisible);

  if (ordersVisible) {
    await ordersTab.click();
    await page.waitForTimeout(2000);
  }

  const screenshotPath = path.join(SCREENSHOT_DIR, "s1-case-b.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const hash = sha256File(screenshotPath);
  console.log(`Saved screenshot to ${screenshotPath}`);
  console.log(`SHA-256: ${hash}`);

  await browser.close();
  try {
    process.kill(srv.pid);
  } catch {}
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
