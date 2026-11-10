import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:/Users/Madara Uchiha/.gemini/antigravity/brain/18add9c3-b079-4511-a558-ab09b127c534";
const BASE_URL = "http://127.0.0.1:3000";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
  });
  const page = await context.newPage();

  // 1. Explore page with real dates and DiscoveryHub
  console.log("Capturing Explore page...");
  await page.goto(`${BASE_URL}/explore`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "clean-explore-real-dates.png"),
    fullPage: false,
  });

  // 2. Market Intelligence Hub in Explore
  console.log("Capturing Market Intelligence Hub...");
  const intelHub = page.locator('text="Market Intelligence Hub"').first();
  if (await intelHub.isVisible()) {
    await intelHub.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "clean-intelligence-hub.png"),
      fullPage: false,
    });
  }

  // 3. Lending page with streamlined header & small positions bar
  console.log("Capturing Lending page...");
  await page.goto(`${BASE_URL}/lend`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "clean-lending-streamlined.png"),
    fullPage: false,
  });

  // 4. Vouchers page with verified chips
  console.log("Capturing Vouchers page...");
  await page.goto(`${BASE_URL}/redeem`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "clean-vouchers.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("All screenshots captured successfully.");
}

run().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
