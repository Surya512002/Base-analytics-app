import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GiftKindPicker from "@/components/voucher/GiftKindPicker";
import VoucherSegmentTabs from "@/components/voucher/VoucherSegmentTabs";
import { VOUCHER_VIEW_TABS } from "@/components/voucher/voucher-constants";

const noop = () => {};

describe("one-link gifts merged into Create", () => {
  it("offers both gift kinds in Create, with the chosen one checked", () => {
    const html = renderToStaticMarkup(createElement(GiftKindPicker, { value: "link", onChange: noop }));
    expect(html).toContain("Personal gift");
    expect(html).toContain("One link for many");
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!aria-checked).)*One link for many/s);
  });

  it("no longer has a separate One link tab", () => {
    expect(VOUCHER_VIEW_TABS.map(([id]) => id)).toEqual(["create", "redeem", "mine"]);
  });

  it("keeps Claim highlighted while claiming a one-link gift", () => {
    const html = renderToStaticMarkup(createElement(VoucherSegmentTabs, { view: "campaign", onChange: noop }));
    expect(html).toMatch(/aria-selected="true"[^>]*>(?:(?!aria-selected).)*Claim/s);
    expect(html).not.toContain("One link");
  });
});
