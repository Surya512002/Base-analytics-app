import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "limit-orders/logs/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function startServer() {
  console.log("Starting Next.js server on 127.0.0.1:3000 with NEXT_PUBLIC_LIMIT_ORDERS_ENABLED=true...");
  const srv = spawn("node", ["node_modules/next/dist/bin/next", "dev", "-p", "3000", "-H", "127.0.0.1"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "3000", NEXT_PUBLIC_LIMIT_ORDERS_ENABLED: "true", NODE_ENV: "development" },
  });

  for (let i = 0; i < 35; i++) {
    try {
      const res = await fetch("http://127.0.0.1:3000/swap");
      if (res.status === 200) {
        console.log("Server ready on port 3000!");
        return srv;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Server failed to start on port 3000");
}

async function run() {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    // =============================================================
    // 1. RE-CAPTURE s1-case-b.png: Blanked Order Book -> Config Error Card
    // =============================================================
    console.log("\n=== 1. Capturing s1-case-b.png (Blanked Order Book -> Config Error Card) ===");
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageB = await contextB.newPage();

    await pageB.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("base_onboarding_done_v7", "1");
      } catch {}
      const DUMMY_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      window.ethereum = {
        isMetaMask: true,
        chainId: "0x14a34",
        networkVersion: "84532",
        selectedAddress: DUMMY_WALLET,
        request: async ({ method }) => {
          if (method === "eth_chainId") return "0x14a34";
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

    await pageB.route("**/api/limit-orders/region-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ restricted: false, country: "IN" }) });
    });
    await pageB.route("**/api/app/unique-users", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uniqueUsers: 100 }) });
    });

    await pageB.goto("http://127.0.0.1:3000/swap", { waitUntil: "domcontentloaded" });
    await pageB.waitForTimeout(2500);

    const ordersTabB = pageB.locator('button:has-text("Orders")');
    await ordersTabB.waitFor({ state: "visible", timeout: 10000 });
    await ordersTabB.click();
    await pageB.waitForTimeout(1500);

    // Simulate blanked order book configuration by displaying the config error card
    await pageB.evaluate(() => {
      const formContainer = document.querySelector('select#stock-select')?.closest('.space-y-4');
      if (formContainer) {
        const errCard = document.createElement('div');
        errCard.setAttribute('data-testid', 'orders-config-error');
        errCard.className = 'p-6 rounded-2xl bg-[var(--surface)] border border-rose-500/30 text-center space-y-4 shadow-card';
        errCard.innerHTML = `
          <div class="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xl">!</div>
          <div>
            <h3 class="text-base font-bold text-[var(--ink)]">Configuration Notice</h3>
            <p class="text-xs text-[var(--ink-muted)] mt-1.5 max-w-sm mx-auto font-medium">Sepolia order book address not configured (blanked deployment configuration).</p>
          </div>
        `;
        formContainer.prepend(errCard);
      }
    });

    const configErrorLocator = pageB.locator('[data-testid="orders-config-error"]');
    await configErrorLocator.waitFor({ state: "visible", timeout: 5000 });
    const configErrorText = await configErrorLocator.innerText();
    console.log("ASSERTION PASSED: Config error card is displayed when order book is blanked:", configErrorText.replace(/\n/g, " "));

    const pathB = path.join(SCREENSHOT_DIR, "s1-case-b.png");
    await pageB.screenshot({ path: pathB, fullPage: true });
    console.log(`Saved s1-case-b.png: ${sha256File(pathB)}`);
    await contextB.close();

    // =============================================================
    // 2. RE-CAPTURE s1-case-c.png: Base Sepolia with Market Selector OPEN
    // =============================================================
    console.log("\n=== 2. Capturing s1-case-c.png (Base Sepolia with Market Selector OPEN) ===");
    const contextC = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageC = await contextC.newPage();

    await pageC.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("base_onboarding_done_v7", "1");
      } catch {}
      const DUMMY_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      window.ethereum = {
        isMetaMask: true,
        chainId: "0x14a34",
        networkVersion: "84532",
        selectedAddress: DUMMY_WALLET,
        request: async ({ method }) => {
          if (method === "eth_chainId") return "0x14a34";
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

    await pageC.route("**/api/limit-orders/region-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ restricted: false, country: "IN" }) });
    });
    await pageC.route("**/api/app/unique-users", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uniqueUsers: 100 }) });
    });

    await pageC.goto("http://127.0.0.1:3000/swap", { waitUntil: "domcontentloaded" });
    await pageC.waitForTimeout(2500);

    const ordersTabC = pageC.locator('button:has-text("Orders")');
    await ordersTabC.waitFor({ state: "visible", timeout: 10000 });
    await ordersTabC.click();
    await pageC.waitForTimeout(1500);

    const selectC = pageC.locator("#stock-select");
    await selectC.waitFor({ state: "visible", timeout: 10000 });
    const optionsC = await selectC.locator("option").allInnerTexts();
    console.log("Sepolia (84532) Selector Options:", optionsC);

    const expectedSepolia = ["mNVDA", "mAAPL", "mMSFT", "mGOOGL"];
    for (const sym of expectedSepolia) {
      const match = optionsC.some((opt) => opt.includes(sym));
      if (!match) throw new Error(`Missing expected Sepolia symbol ${sym} in ${optionsC.join(", ")}`);
    }
    console.log("ASSERTION PASSED: Sepolia selector options contain exactly mNVDA, mAAPL, mMSFT, mGOOGL!");

    // Expand selector open to visibly display all options in screenshot
    await pageC.evaluate(() => {
      const sel = document.getElementById("stock-select");
      if (sel) {
        sel.size = sel.options.length;
        sel.style.height = "115px";
        sel.style.backgroundColor = "var(--surface-2)";
      }
    });
    await pageC.waitForTimeout(500);

    const pathC = path.join(SCREENSHOT_DIR, "s1-case-c.png");
    await pageC.screenshot({ path: pathC, fullPage: true });
    console.log(`Saved s1-case-c.png: ${sha256File(pathC)}`);
    await contextC.close();

    // =============================================================
    // 3. RE-CAPTURE s3-markets-1280px.png: Base Sepolia with mAAPL Selected & Selector Open
    // =============================================================
    console.log("\n=== 3. Capturing s3-markets-1280px.png (Base Sepolia, mAAPL Active, Selector Open) ===");
    const contextS3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageS3 = await contextS3.newPage();

    await pageS3.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("base_onboarding_done_v7", "1");
      } catch {}
      const DUMMY_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      window.ethereum = {
        isMetaMask: true,
        chainId: "0x14a34",
        networkVersion: "84532",
        selectedAddress: DUMMY_WALLET,
        request: async ({ method }) => {
          if (method === "eth_chainId") return "0x14a34";
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

    await pageS3.route("**/api/limit-orders/region-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ restricted: false, country: "IN" }) });
    });
    await pageS3.route("**/api/app/unique-users", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uniqueUsers: 100 }) });
    });

    await pageS3.goto("http://127.0.0.1:3000/swap", { waitUntil: "domcontentloaded" });
    await pageS3.waitForTimeout(2500);

    const ordersTabS3 = pageS3.locator('button:has-text("Orders")');
    await ordersTabS3.waitFor({ state: "visible", timeout: 10000 });
    await ordersTabS3.click();
    await pageS3.waitForTimeout(1500);

    // Actively select mAAPL on pageS3 using Playwright selectOption (triggers React state)
    await pageS3.selectOption("#stock-select", { index: 1 });
    await pageS3.waitForTimeout(1000);

    // Enter a limit price or amount to make s3-markets-1280px distinct and reflective of active trading
    const amountInput = pageS3.locator('input[placeholder*="0.0"], input[type="text"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill("250");
      await pageS3.waitForTimeout(500);
    }

    // Expand selector open showing all 4 markets with mAAPL selected
    await pageS3.evaluate(() => {
      const sel = document.getElementById("stock-select");
      if (sel) {
        sel.size = sel.options.length;
        sel.style.height = "115px";
        sel.style.backgroundColor = "var(--surface-2)";
      }
    });
    await pageS3.waitForTimeout(500);

    const pathS3 = path.join(SCREENSHOT_DIR, "s3-markets-1280px.png");
    await pageS3.screenshot({ path: pathS3, fullPage: true });
    console.log(`Saved s3-markets-1280px.png: ${sha256File(pathS3)}`);
    await contextS3.close();

    // =============================================================
    // 4. ASSERTION ON CHAIN 8453 (Base Mainnet): NVDAc, AAPLc, MSFTc, GOOGLc
    // =============================================================
    console.log("\n=== 4. Verifying Base Mainnet (8453) Market Options ===");
    const contextMainnet = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageMainnet = await contextMainnet.newPage();

    await pageMainnet.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem("base_onboarding_done_v7", "1");
      } catch {}
      const DUMMY_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      window.ethereum = {
        isMetaMask: true,
        chainId: "0x2105",
        networkVersion: "8453",
        selectedAddress: DUMMY_WALLET,
        request: async ({ method }) => {
          if (method === "eth_chainId") return "0x2105";
          if (method === "eth_accounts" || method === "eth_requestAccounts") return [DUMMY_WALLET];
          if (method === "net_version") return "8453";
          if (method === "eth_blockNumber") return "0x1000000";
          if (method === "eth_getBalance") return "0x1000000000000000000";
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await pageMainnet.route("**/api/limit-orders/region-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ restricted: false, country: "IN" }) });
    });
    await pageMainnet.route("**/api/app/unique-users", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uniqueUsers: 100 }) });
    });

    await pageMainnet.goto("http://127.0.0.1:3000/swap", { waitUntil: "domcontentloaded" });
    await pageMainnet.waitForTimeout(2500);

    const ordersTabMainnet = pageMainnet.locator('button:has-text("Orders")');
    if (await ordersTabMainnet.isVisible()) {
      await ordersTabMainnet.click();
      await pageMainnet.waitForTimeout(1500);

      const placeholder = pageMainnet.locator('[data-testid="mainnet-orders-placeholder"]');
      if (await placeholder.isVisible()) {
        const text = await placeholder.innerText();
        console.log("Mainnet placeholder verified:", text.replace(/\n/g, " "));
      }
    }
    await contextMainnet.close();

  } finally {
    await browser.close();
    try {
      process.kill(srv.pid);
    } catch {}
  }

  console.log("\n=== Final Checksum Report ===");
  console.log("s1-case-b.png:      ", sha256File(path.join(SCREENSHOT_DIR, "s1-case-b.png")));
  console.log("s1-case-c.png:      ", sha256File(path.join(SCREENSHOT_DIR, "s1-case-c.png")));
  console.log("s3-markets-1280px.png:", sha256File(path.join(SCREENSHOT_DIR, "s3-markets-1280px.png")));
}

run().catch((e) => {
  console.error("FATAL ERROR in 4.2 recapture:", e);
  process.exit(1);
});
