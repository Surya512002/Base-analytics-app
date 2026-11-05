import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const MOBILE_VIEWPORTS = [
  { name: "iPhone SE (320px)", width: 320, height: 568 },
  { name: "iPhone 14 (390px)", width: 390, height: 844 },
];

const ROUTES = ["/", "/explore", "/swap", "/lend", "/launch", "/redeem"];

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Mobile input font-size verification (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`verifies all inputs on ${route} have computed font-size >= 16px to prevent iOS auto-zoom`, async ({
        page,
      }) => {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });

        const violations = await page.evaluate(() => {
          const inputs = document.querySelectorAll(
            'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="hidden"]), select, textarea'
          );
          const issues = [];
          for (const el of inputs) {
            const style = window.getComputedStyle(el);
            const size = parseFloat(style.fontSize);
            if (size < 15.9) {
              issues.push({
                tag: el.tagName.toLowerCase(),
                placeholder: (el as HTMLInputElement).placeholder || "",
                fontSize: style.fontSize,
                className: typeof el.className === "string" ? el.className.slice(0, 50) : "",
              });
            }
          }
          return issues;
        });

        expect(violations).toEqual([]);
      });
    }
  });
}
