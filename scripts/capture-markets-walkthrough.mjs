import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "C:/Users/Madara Uchiha/.gemini/antigravity/brain/18add9c3-b079-4511-a558-ab09b127c534";
const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

async function run() {
  console.log(`Connecting to browser, BASE_URL=${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Light Mode: Explore with Overview Strip & Signals
    console.log("1. Capturing Desktop Explore (Light)...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "light",
    });
    const page = await desktopContext.newPage();
    await page.goto(`${BASE_URL}/explore`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "markets-explore-desktop-light.png"),
      fullPage: false,
    });
    console.log("Saved markets-explore-desktop-light.png");

    // 2. Desktop: Stocks Table (Click 'Stocks' Catalog Tab)
    console.log("2. Switching to Stocks tab...");
    const stocksTab = page.locator('button:has-text("Stocks")').first();
    if (await stocksTab.isVisible()) {
      await stocksTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "markets-stocks-table-desktop.png"),
        fullPage: false,
      });
      console.log("Saved markets-stocks-table-desktop.png");
    }

    // 3. Open Stock Detail Drawer
    console.log("3. Opening Stock Detail Drawer...");
    const nvdaRow = page.locator('text="NVDAc"').first();
    if (await nvdaRow.isVisible()) {
      await nvdaRow.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "markets-stock-detail-drawer.png"),
        fullPage: false,
      });
      console.log("Saved markets-stock-detail-drawer.png");
    }
    await desktopContext.close();

    // 4. Mobile Viewport (375px): Explore Hub with Mobile Cards
    console.log("4. Capturing Mobile (375px)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      colorScheme: "dark",
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/explore`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await mobilePage.waitForTimeout(2500);

    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, "markets-explore-mobile-dark.png"),
      fullPage: false,
    });
    console.log("Saved markets-explore-mobile-dark.png");
    await mobileContext.close();

    // 5. Swap Page with Preselected Stock & Price Impact Layer
    console.log("5. Capturing Swap Preselection & Safety Badges...");
    const swapContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    const swapPage = await swapContext.newPage();
    await swapPage.goto(`${BASE_URL}/swap?buy=0xb20000000000000000000078ee7ce2fe4908108c`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await swapPage.waitForTimeout(2500);

    await swapPage.screenshot({
      path: path.join(ARTIFACT_DIR, "markets-swap-preselected-safety.png"),
      fullPage: false,
    });
    console.log("Saved markets-swap-preselected-safety.png");
    await swapContext.close();

    console.log("All screenshots captured successfully!");
  } catch (err) {
    console.error("Capture error:", err);
  } finally {
    await browser.close();
  }
}

run();
