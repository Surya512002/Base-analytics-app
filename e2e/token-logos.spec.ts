import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("Token Logo Rendering and Image Integrity", () => {
  const pagesToCheck = [
    { name: "Explore", path: "/explore" },
    { name: "Swap", path: "/swap" },
    { name: "Lend & Stake", path: "/lend" },
    { name: "Launch", path: "/launch" },
    { name: "Profile", path: "/profile" },
  ];

  for (const { name, path } of pagesToCheck) {
    test(`${name} page contains no broken <img> elements and renders token logos`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      // Allow image lazy loads and fallback resolutions to settle
      await page.waitForTimeout(2000);

      // Verify all rendered <img> elements have naturalWidth > 0
      const brokenImages = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll("img"));
        return images
          .filter((img) => {
            // Only check images that are actually attached to the DOM and have a src
            return (
              img.src &&
              !img.src.startsWith("data:image/svg+xml;base64,PHN2Zy") &&
              img.complete &&
              img.naturalWidth === 0
            );
          })
          .map((img) => ({
            src: img.src,
            alt: img.alt,
            className: img.className,
          }));
      });

      expect(
        brokenImages,
        `Found broken images on ${name} (${path}): ${JSON.stringify(brokenImages, null, 2)}`
      ).toEqual([]);
    });
  }
});
