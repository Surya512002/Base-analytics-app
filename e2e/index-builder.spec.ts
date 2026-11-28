import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const SHARED = "mix=NVDAc-20,AAPLc-15.5&max=25&cash=10";

test.describe("Shared index page", () => {
  test("shows what is in the link, with a preview card", async ({ page, request }) => {
    await page.goto(`${BASE}/copy-index?${SHARED}`);
    await expect(page.getByRole("heading", { name: "A stock index on Base" })).toBeVisible();
    await expect(page.locator("main")).toContainText("15.5%");
    const card = new URL((await page.locator('meta[property="og:image"]').getAttribute("content"))!);
    const image = await request.get(`${BASE}${card.pathname}${card.search}`);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("never shows text from a link that isn't a real index", async ({ page }) => {
    await page.goto(`${BASE}/copy-index?mix=SCAMc-90,AAPLc-5&max=100&cash=0`);
    await expect(page.locator("main")).toContainText("doesn't hold a complete index");
    await expect(page.locator("main")).not.toContainText("SCAMc");
  });
});

test.describe("Build your own index", () => {
  test.beforeEach(async ({ page }) => {
    // Only the app's own API gets the test country; on every request the header breaks chain reads.
    await page.route("**/api/**", (r) => r.continue({ headers: { ...r.request().headers(), "x-mock-country": "DE" } }));
    // Auto-invest, where the index lives, is part of the orders feature. Ask the Trade page, not the
    // index itself, so a broken index fails instead of being skipped.
    await page.goto(`${BASE}/trade`, { waitUntil: "domcontentloaded" });
    const enabled = await page.locator('.place-tabs a:has-text("Auto-invest")').waitFor({ timeout: 10_000 }).then(() => true, () => false);
    test.skip(!enabled, "Orders feature flag is off in this build");
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

  test("fills the builder from a shared link", async ({ page }) => {
    await page.goto(`${BASE}/copy-index?${SHARED}`);
    await page.getByRole("link", { name: "Copy this index" }).click();
    await expect(page.getByText("You opened a shared index")).toBeVisible({ timeout: 15_000 });
    const weights = page.getByRole("textbox", { name: /weight in percent/ });
    await expect(weights).toHaveCount(2);
    await expect(weights.first()).toHaveValue("20");
    await expect(weights.nth(1)).toHaveValue("15.5");
  });

  test("leaves a theme's companies out", async ({ page }) => {
    await page.goto(`${BASE}/swap?mode=recurring&plan=index`);
    await expect(page.getByRole("button", { name: "Leave out NVDAc" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("group", { name: "Leave out" }).getByRole("button", { name: "Big Tech" }).click();
    await expect(page.getByRole("button", { name: "Leave out NVDAc" })).toHaveCount(0);
  });
});
