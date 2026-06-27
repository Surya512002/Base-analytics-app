#!/usr/bin/env node
/**
 * Capture 3 app screenshots at 1284×2778px (App Store / iPhone size).
 * Usage: node scripts/capture-screenshots.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "screenshots");
const WIDTH = 1284;
const HEIGHT = 2778;
const BASE = process.argv[2] || "http://localhost:3000";

const SHOTS = [
  {
    file: "screenshot-1-connect.png",
    url: `${BASE}/capture?screen=connect`,
    waitMs: 2500,
  },
  {
    file: "screenshot-2-dashboard.png",
    url: `${BASE}/capture?screen=dashboard`,
    waitMs: 3500,
  },
  {
    file: "screenshot-3-voucher.png",
    url: `${BASE}/capture?screen=voucher`,
    waitMs: 3000,
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const launchOpts = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  const chromiumPaths = [
    process.env.CHROME_PATH,
    "/snap/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  for (const p of chromiumPaths) {
    try {
      const { access } = await import("fs/promises");
      await access(p);
      launchOpts.executablePath = p;
      break;
    } catch {
      /* try next */
    }
  }

  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });

  for (const shot of SHOTS) {
    const page = await context.newPage();
    console.log(`Capturing ${shot.file} …`);
    await page.goto(shot.url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(shot.waitMs);
    const outPath = path.join(OUT_DIR, shot.file);
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    console.log(`  → ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log("\nDone — 3 screenshots at 1284×2778px in public/screenshots/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
