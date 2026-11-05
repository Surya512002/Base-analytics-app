import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { name: "iPhone-SE", width: 320, height: 568 },
  { name: "iPhone-14", width: 390, height: 844 },
  { name: "iPhone-ProMax", width: 430, height: 932 },
  { name: "Pixel-7", width: 412, height: 915 },
  { name: "iPad-Portrait", width: 768, height: 1024 },
  { name: "Desktop", width: 1280, height: 800 },
];

const ROUTES = [
  "/",
  "/explore",
  "/swap",
  "/lend",
  "/launch",
  "/profile",
  "/redeem",
  "/docs",
  "/terms",
  "/privacy",
  "/risk-disclosure",
  "/restricted-regions",
];

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("./docs/qa-screenshots");

async function main() {
  console.log("Starting Mobile & Desktop QA Diagnostic...");
  const browser = await chromium.launch({
    headless: true,
    channel: "msedge" // On windows, msedge is always installed
  }).catch(() => chromium.launch({ headless: true }));

  const report = {
    timestamp: new Date().toISOString(),
    overflowIssues: [],
    smallFontInputs: [],
    smallTouchTargets: [],
    consoleErrors: [],
    routeResults: [],
  };

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.width < 768 
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });

    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        report.consoleErrors.push({
          viewport: vp.name,
          url: page.url(),
          text: msg.text(),
        });
      }
    });

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route}`;
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(1000); // Allow render and hydration

        const status = resp ? resp.status() : "no-resp";

        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          const docScroll = document.documentElement.scrollWidth;
          const bodyScroll = document.body.scrollWidth;
          const winWidth = window.innerWidth;
          const hasOverflow = docScroll > winWidth || bodyScroll > winWidth;

          let offendingElements = [];
          if (hasOverflow) {
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > winWidth + 2) {
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === "string") ? el.className.slice(0, 80) : "";
                const id = el.id ? `#${el.id}` : "";
                offendingElements.push({
                  selector: `${tag}${id}.${cls.trim().split(/\s+/).slice(0, 2).join(".")}`,
                  rectRight: Math.round(rect.right),
                  rectWidth: Math.round(rect.width),
                  winWidth,
                });
                if (offendingElements.length >= 5) break;
              }
            }
          }
          return { hasOverflow, docScroll, bodyScroll, winWidth, offendingElements };
        }, vp.width);

        if (overflow.hasOverflow) {
          report.overflowIssues.push({
            viewport: vp.name,
            route,
            docScroll: overflow.docScroll,
            winWidth: overflow.winWidth,
            elements: overflow.offendingElements,
          });
          console.log(`  [OVERFLOW] ${route} scrollWidth=${overflow.docScroll} > winWidth=${overflow.winWidth}`);
        }

        // Check inputs < 16px computed font size on mobile
        if (vp.width < 768) {
          const smallInputs = await page.evaluate(() => {
            const inputs = document.querySelectorAll("input, select, textarea");
            const list = [];
            for (const el of inputs) {
              const style = window.getComputedStyle(el);
              const fontSize = parseFloat(style.fontSize);
              if (fontSize < 16) {
                list.push({
                  tag: el.tagName.toLowerCase(),
                  type: el.type || "",
                  placeholder: el.placeholder || "",
                  fontSize: style.fontSize,
                  className: (el.className && typeof el.className === "string") ? el.className.slice(0, 60) : "",
                });
              }
            }
            return list;
          });

          if (smallInputs.length > 0) {
            for (const si of smallInputs) {
              report.smallFontInputs.push({
                viewport: vp.name,
                route,
                ...si,
              });
            }
            console.log(`  [FONT < 16px] ${route} found ${smallInputs.length} inputs with font-size < 16px`);
          }
        }

        // Save screenshot
        const screenshotFileName = `${vp.name}_${route.replace(/\//g, "_") || "home"}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFileName);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        report.routeResults.push({
          viewport: vp.name,
          route,
          status,
          overflow: overflow.hasOverflow,
          screenshot: `docs/qa-screenshots/${screenshotFileName}`,
        });

      } catch (err) {
        console.error(`  [ERROR] ${route}: ${err.message}`);
        report.routeResults.push({
          viewport: vp.name,
          route,
          error: err.message,
        });
      }
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.resolve("./docs/mobile-audit-results.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  console.log("\nAudit complete! Saved results to docs/mobile-audit-results.json");
}

main().catch(console.error);
