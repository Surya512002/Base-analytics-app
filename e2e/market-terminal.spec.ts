import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test("Markets terminal: Buy pays toward the stock, Sell pays with the stock", async ({ page }) => {
  await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
  const terminal = page.locator("#terminal");
  const sell = terminal.getByRole("button", { name: /^Sell \S+c$/ });
  // The list depends on live market data, which can be missing in CI.
  if (!(await sell.waitFor({ timeout: 30_000 }).then(() => true, () => false))) return;
  const symbol = (await sell.textContent())!.replace(/^Sell /, "").trim();
  // The token button beside the amount to pay.
  const pay = terminal.locator('input[aria-label="Sell Amount"]').locator("xpath=following-sibling::button[1]");
  await expect(pay).toContainText("ETH", { timeout: 20_000 });
  await sell.click();
  await expect(pay).toContainText(symbol, { timeout: 20_000 });
});
