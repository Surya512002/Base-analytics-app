import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("Build your own index", () => {
  test.beforeEach(async ({ page }) => {
    // Only the app's own API gets the test country; on every request the header breaks chain reads.
    await page.route("**/api/**", (r) => r.continue({ headers: { ...r.request().headers(), "x-mock-country": "DE" } }));
  });

  test("warns about a breached limit and fits the weights back to the rules", async ({ page }) => {
    await page.goto(`${BASE}/swap?mode=recurring&plan=index`);
    await expect(page.getByRole("heading", { name: "Build your own index" })).toBeVisible({ timeout: 15_000 });

    const first = page.getByRole("textbox", { name: /weight in percent/ }).first();
    await first.fill("40");
    const warnings = page.getByRole("list", { name: "Index warnings" });
    await expect(warnings).toContainText("is 40%, above your 25% limit.");
    await expect(page.getByRole("button", { name: "Fix the warnings to continue" })).toBeDisabled();

    await page.getByRole("button", { name: "Fit the weights to my rules" }).click();
    await expect(first).toHaveValue("25");
    await expect(page.getByText(/above your 25% limit/)).toHaveCount(0);
  });

  test("leaves a theme's companies out", async ({ page }) => {
    await page.goto(`${BASE}/swap?mode=recurring&plan=index`);
    await expect(page.getByRole("button", { name: "Leave out NVDAc" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("group", { name: "Leave out" }).getByRole("button", { name: "Big Tech" }).click();
    await expect(page.getByRole("button", { name: "Leave out NVDAc" })).toHaveCount(0);
  });
});
