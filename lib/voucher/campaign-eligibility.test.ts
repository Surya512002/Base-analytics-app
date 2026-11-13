import { describe, expect, it } from "vitest";
import { evaluateClaimEligibility, type CampaignAssetInfo } from "./campaign-server";
import type { OnchainCampaign } from "./campaign";

const now = Math.floor(Date.now() / 1000);
const campaign: OnchainCampaign = {
  creator: "0x00000000000000000000000000000000000000c1",
  token: "0x00000000000000000000000000000000000000aa",
  amountPerClaim: 1n,
  maxClaims: 5,
  claimedCount: 0,
  unlockAt: 0,
  expiresAt: now + 3600,
  claimSigner: "0x00000000000000000000000000000000000000ee",
  linkSigner: "0x00000000000000000000000000000000000000dd",
  committed: false,
  closed: false,
};
const stock: CampaignAssetInfo = { kind: "stock", symbol: "NVDAc", decimals: 8, regulated: true, recognised: true };
const usdc: CampaignAssetInfo = { kind: "usdc", symbol: "USDC", decimals: 6, regulated: false, recognised: true };

// claimer: null keeps these tests offline (no hasClaimed / sanctions RPC)
const run = (over: Partial<OnchainCampaign>, country: string | null, asset = stock) =>
  evaluateClaimEligibility({ campaignId: 1n, campaign: { ...campaign, ...over }, claimer: null, country, asset });

describe("recipient eligibility before claim", () => {
  it("refuses a tokenized-stock gift in a restricted region (ineligible → share stays in escrow)", async () => {
    const r = await run({}, "US");
    expect(r.eligible).toBe(false);
    const region = r.checks.find((c) => c.id === "region");
    expect(region?.result).toBe("fail");
    expect(region?.detail).toMatch(/goes back to the sender/);
  });

  it("allows the same stock gift in a permitted region", async () => {
    const r = await run({}, "DE");
    expect(r.eligible).toBe(true);
    expect(r.checks.find((c) => c.id === "region")?.result).toBe("pass");
  });

  it("fails closed when the region can't be verified", async () => {
    const r = await run({}, null);
    expect(r.eligible).toBe(false);
    expect(r.checks.find((c) => c.id === "region")?.detail).toMatch(/couldn't be verified/);
  });

  it("skips region rules for non-stock gifts", async () => {
    const r = await run({}, "US", usdc);
    expect(r.eligible).toBe(true);
    expect(r.checks.some((c) => c.id === "region")).toBe(false);
  });

  it("refuses expired, full, closed and locked gifts with a clear reason", async () => {
    expect((await run({ expiresAt: now - 10 }, "DE")).reason).toMatch(/expired/);
    expect((await run({ claimedCount: 5 }, "DE")).reason).toMatch(/All slots/);
    expect((await run({ closed: true }, "DE")).reason).toMatch(/closed/);
    expect((await run({ unlockAt: now + 600 }, "DE")).reason).toMatch(/Opens/);
  });
});
