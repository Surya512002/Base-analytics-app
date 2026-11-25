import { beforeEach, describe, expect, it } from "vitest";
import { alertAddress, dueAlerts, isWatchable } from "@/lib/alerts/price-watch";
import { _resetAlertMemoryStoreForTesting, markSmarterAlertTriggered, readSmarterAlerts, saveSmarterAlert, type SmarterAlert } from "@/lib/alerts/smarter-alerts";
import { shouldWarnLiquidation, WARN_AGAIN_AFTER_MS } from "@/lib/lending/liquidation-warning";
import { ageText, chainlinkFeedFor } from "@/lib/stocks/chainlink-reference";

const NVDA = "0xb20000000000000000000078ee7ce2fe4908108c";
const alert = (over: Partial<SmarterAlert>): SmarterAlert => ({ id: "a", type: "price", channel: "in_app", targetSymbol: "NVDAc", thresholdValue: 150, direction: "above", createdAt: 0, triggered: false, ...over });

describe("price watch", () => {
  beforeEach(() => _resetAlertMemoryStoreForTesting());

  it("names only official stocks and major tokens by symbol", () => {
    expect(alertAddress({ targetSymbol: "nvdac" })).toBe(NVDA);
    expect(alertAddress({ targetSymbol: "ETH" })).toBe("0x4200000000000000000000000000000000000006");
    expect(alertAddress({ targetSymbol: "SCAMCOIN" })).toBeNull();
    expect(alertAddress({ targetSymbol: "SCAMCOIN", targetAddress: "0xAbC" })).toBe("0xabc");
  });

  it("fires when the price is reached, on the right side only", () => {
    const prices = new Map([[NVDA, 151]]);
    expect(dueAlerts([alert({})], prices)).toHaveLength(1);
    expect(dueAlerts([alert({ direction: "below" })], prices)).toHaveLength(0);
    expect(dueAlerts([alert({ thresholdValue: 160 })], prices)).toHaveLength(0);
  });

  it("stays quiet without a price, once reached, or for kinds that are not checked", () => {
    expect(dueAlerts([alert({})], new Map())).toHaveLength(0);
    expect(dueAlerts([alert({ triggered: true })], new Map([[NVDA, 200]]))).toHaveLength(0);
    expect(isWatchable(alert({ type: "whale_swap" }))).toBe(false);
  });

  it("remembers that an alert was reached", () => {
    const [saved] = saveSmarterAlert(null, { type: "price", channel: "in_app", targetSymbol: "NVDAc", thresholdValue: 1, direction: "above" });
    markSmarterAlertTriggered(null, saved!.id);
    expect(readSmarterAlerts(null)[0]!.triggered).toBe(true);
  });
});

describe("liquidation warning", () => {
  const base = { enabled: true, healthFactor: 1.1, debtUsd: 100, lastWarnedAt: 0, now: WARN_AGAIN_AFTER_MS };
  it("warns only for a risky loan, when switched on, and not too often", () => {
    expect(shouldWarnLiquidation(base)).toBe(true);
    expect(shouldWarnLiquidation({ ...base, healthFactor: 1.3 })).toBe(false);
    expect(shouldWarnLiquidation({ ...base, healthFactor: null })).toBe(false);
    expect(shouldWarnLiquidation({ ...base, debtUsd: 0 })).toBe(false);
    expect(shouldWarnLiquidation({ ...base, enabled: false })).toBe(false);
    expect(shouldWarnLiquidation({ ...base, lastWarnedAt: 1 })).toBe(false);
  });
});

describe("chainlink reference", () => {
  it("has a feed for listed stocks and none for other tokens", () => {
    expect(chainlinkFeedFor(NVDA)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(chainlinkFeedFor("0x4200000000000000000000000000000000000006")).toBeNull();
  });
  it("says how old a price is", () => {
    expect(ageText(100, 130)).toBe("just now");
    expect(ageText(0, 600)).toBe("10 min ago");
    expect(ageText(0, 7200)).toBe("2 h ago");
    expect(ageText(0, 4 * 86_400)).toBe("4 days ago");
  });
});
