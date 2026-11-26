import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LendingViewTabs, { type LendingViewTab } from "@/components/lending/LendingViewTabs";

const html = (value: LendingViewTab) =>
  renderToStaticMarkup(React.createElement(LendingViewTabs, { value, onChange: () => {}, vaultsCount: 6 }));

describe("Earn switches", () => {
  it("has two places and a Compare rates link, with one stock list and no second row", () => {
    const markets = html("markets");
    expect(markets).toContain("Lend and borrow");
    expect(markets).toContain("Vaults and staking (6)");
    expect(markets).toContain('href="/lend?view=compare"');
    expect(markets).not.toContain("By stock");
    expect(markets).not.toContain("Yield scanner");
  });

  it("shows both comparison tools under Compare rates", () => {
    for (const view of ["compare", "finder"] as const) {
      expect(html(view)).toContain("Protocols side by side");
      expect(html(view)).toContain("Yield scanner");
    }
  });
});
