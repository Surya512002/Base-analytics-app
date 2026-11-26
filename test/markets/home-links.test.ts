import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SimpleStart from "@/components/home/SimpleStart";
import { ENTRIES } from "@/lib/nav/directory";

vi.mock("@/hooks/useMarketsData", () => ({ useStockMarkets: () => ({ stocks: [], loading: true }) }));

describe("Home", () => {
  it("links to every place in the app, and shows no price before one arrives", () => {
    const html = renderToStaticMarkup(createElement(SimpleStart));
    const missing = ENTRIES.filter((e) => !html.includes(`href="${e.href.replace(/&/g, "&amp;")}"`));
    expect(missing.map((e) => e.id)).toEqual([]);
    expect(html).toContain("Loading prices…");
    expect(html).not.toMatch(/\$\d/);
  });
});
