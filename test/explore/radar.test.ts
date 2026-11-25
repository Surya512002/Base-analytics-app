import { describe, expect, it } from "vitest";
import { RADAR_MAX_EVENTS, radarEvents, type RadarTransfer } from "@/lib/smart-money/radar";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const t = (over: Partial<RadarTransfer>): RadarTransfer => ({ hash: "0x1", asset: "USDC", value: 1234.5678, rawContract: { address: USDC }, metadata: { blockTimestamp: "2026-11-25T00:00:00Z" }, ...over });

describe("radarEvents", () => {
  it("lists verified tokens and drops spam airdrops, even ones using a familiar symbol", () => {
    const events = radarEvents([t({}), t({ asset: "USDC", rawContract: { address: "0x1111111111111111111111111111111111111111" } })], "0xw", "w");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tokenSymbol: "USDC", amount: "1,234.57", tokenAddress: USDC.toLowerCase() });
  });

  it("skips empty transfers and keeps only the newest few", () => {
    expect(radarEvents([t({ value: 0 }), t({ value: null }), t({ rawContract: {} })], "0xw", "w")).toHaveLength(0);
    expect(radarEvents(Array.from({ length: 20 }, () => t({})), "0xw", "w")).toHaveLength(RADAR_MAX_EVENTS);
  });
});
