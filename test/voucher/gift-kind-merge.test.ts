import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import VoucherSegmentTabs from "@/components/voucher/VoucherSegmentTabs";
import { VOUCHER_VIEW_TABS } from "@/components/voucher/voucher-constants";
import { buildSenderIdentity } from "@/lib/voucher/campaign";

const noop = () => {};
const WALLET = "0x7C40c792f376d2921854faa4c52985b906aae2F3";

describe("one create flow for personal and one-link gifts", () => {
  it("has no separate One link tab", () => {
    expect(VOUCHER_VIEW_TABS.map(([id]) => id)).toEqual(["create", "redeem", "mine"]);
  });

  it("keeps Claim highlighted while claiming a one-link gift", () => {
    const html = renderToStaticMarkup(createElement(VoucherSegmentTabs, { view: "campaign", onChange: noop }));
    expect(html).toMatch(/aria-selected="true"[^>]*>(?:(?!aria-selected).)*Claim/s);
    expect(html).not.toContain("One link");
  });

  it("identifies a personal-gift sender the same way as a one-link sender", () => {
    // Personal gifts have no typed name: the Basename (if any) and the onchain creator address.
    expect(buildSenderIdentity(WALLET, "", "alice.base.eth")).toMatchObject({
      trust: "basename-verified",
      basename: "alice.base.eth",
      address: WALLET,
    });
    expect(buildSenderIdentity(WALLET, "", null).trust).toBe("address-only");
  });
});
