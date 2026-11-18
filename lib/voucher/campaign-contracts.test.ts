import { afterEach, describe, expect, it, vi } from "vitest";

const V2 = "0x1111111111111111111111111111111111111111";
const V3 = "0x3333333333333333333333333333333333333333";

async function load(env: { primary?: string; legacy?: string }) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_CONTRACT", env.primary ?? "");
  vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_CONTRACT_LEGACY", env.legacy ?? "");
  return import("./campaign-contracts");
}

afterEach(() => vi.unstubAllEnvs());

describe("contractForCampaignId", () => {
  it("today (only v2 configured): every id goes to v2, exactly as before", async () => {
    const m = await load({ primary: V2 });
    expect(m.contractForCampaignId(1)).toBe(V2);
    expect(m.contractForCampaignId(57)).toBe(V2);
    expect(m.campaignContracts()).toEqual([{ address: V2, firstId: BigInt(1) }]);
  });

  it("after the v3 upgrade: old links stay on v2, new ids go to v3", async () => {
    const m = await load({ primary: V3, legacy: V2 });
    expect(m.contractForCampaignId(1)).toBe(V2);
    expect(m.contractForCampaignId("999999999")).toBe(V2);
    expect(m.contractForCampaignId("1000000001")).toBe(V3);
    expect(m.contractForCampaignId(BigInt("1000000123"))).toBe(V3);
    expect(m.campaignContracts().map((c) => c.address)).toEqual([V2, V3]);
  });

  it("rejects nonsense ids and works with nothing configured", async () => {
    const m = await load({ primary: V2 });
    expect(m.contractForCampaignId(0)).toBeNull();
    expect(m.contractForCampaignId("abc")).toBeNull();
    const none = await load({});
    expect(none.contractForCampaignId(1)).toBeNull();
    expect(none.campaignContracts()).toEqual([]);
  });
});
