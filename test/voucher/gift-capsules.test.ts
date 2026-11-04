import { describe, it, expect } from "vitest";
import {
  buildGiftCapsuleShareUrls,
  verifyGiftCapsuleSecret,
} from "@/lib/voucher/gift-capsule";

describe("Gift Capsules Logic & Share Suite", () => {
  it("builds valid Warpcast and Twitter share URLs with card metadata", () => {
    const urls = buildGiftCapsuleShareUrls({
      cardId: "12-3",
      asset: "USDC",
      amountFormatted: "$25.00",
      message: "Happy Birthday!",
    });

    expect(urls.shareText).toContain("$25.00 USDC");
    expect(urls.warpcast).toContain("warpcast.com/~/compose");
    expect(urls.warpcast).toContain(encodeURIComponent("12-3"));
    expect(urls.twitter).toContain("twitter.com/intent/tweet");
  });

  it("validates gift capsule cardId and secret format strictly", () => {
    // Valid
    expect(verifyGiftCapsuleSecret("5-0", "ABCDE-12345-FGHIJ")).toBe(true);

    // Invalid cardId
    expect(verifyGiftCapsuleSecret("invalid", "ABCDE-12345-FGHIJ")).toBe(false);

    // Too short secret
    expect(verifyGiftCapsuleSecret("5-0", "short")).toBe(false);

    // Empty
    expect(verifyGiftCapsuleSecret("", "")).toBe(false);
  });
});
