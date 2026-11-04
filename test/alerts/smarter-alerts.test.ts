import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateAlertTrigger,
  saveSmarterAlert,
  readSmarterAlerts,
  deleteSmarterAlert,
  _resetAlertMemoryStoreForTesting,
  type SmarterAlert,
} from "@/lib/alerts/smarter-alerts";

describe("Smarter Alerts Engine", () => {
  beforeEach(() => {
    _resetAlertMemoryStoreForTesting();
  });

  it("evaluates price trigger above threshold", () => {
    const alert: SmarterAlert = {
      id: "a1",
      type: "price",
      channel: "in_app",
      targetSymbol: "ETH",
      thresholdValue: 3500,
      direction: "above",
      createdAt: Date.now(),
      triggered: false,
    };

    const res1 = evaluateAlertTrigger(alert, { symbol: "ETH", currentPriceUsd: 3450 });
    expect(res1.triggered).toBe(false);

    const res2 = evaluateAlertTrigger(alert, { symbol: "ETH", currentPriceUsd: 3520 });
    expect(res2.triggered).toBe(true);
    expect(res2.reason).toContain("reached $3520.00");
  });

  it("evaluates whale swap alert (> $25,000)", () => {
    const alert: SmarterAlert = {
      id: "a2",
      type: "whale_swap",
      channel: "browser",
      targetSymbol: "DEGEN",
      thresholdValue: 25_000,
      createdAt: Date.now(),
      triggered: false,
    };

    const under = evaluateAlertTrigger(alert, { symbol: "DEGEN", swapAmountUsd: 12_000 });
    expect(under.triggered).toBe(false);

    const over = evaluateAlertTrigger(alert, { symbol: "DEGEN", swapAmountUsd: 48_000 });
    expect(over.triggered).toBe(true);
    expect(over.reason).toContain("Whale swap of $48,000");
  });

  it("evaluates yield spike alert (> 5% APY)", () => {
    const alert: SmarterAlert = {
      id: "a3",
      type: "yield_spike",
      channel: "in_app",
      targetSymbol: "USDC",
      thresholdValue: 5,
      createdAt: Date.now(),
      triggered: false,
    };

    const normal = evaluateAlertTrigger(alert, { symbol: "USDC", currentApy: 7.2, previousApy: 6.0 });
    expect(normal.triggered).toBe(false);

    const spike = evaluateAlertTrigger(alert, { symbol: "USDC", currentApy: 14.5, previousApy: 6.0 });
    expect(spike.triggered).toBe(true);
    expect(spike.reason).toContain("spiked +8.5%");
  });

  it("evaluates liquidity drop alert (> 15% drop)", () => {
    const alert: SmarterAlert = {
      id: "a4",
      type: "liquidity_drop",
      channel: "webhook",
      targetSymbol: "NVDAc",
      thresholdValue: 15,
      webhookUrl: "https://discord.com/api/webhooks/mock",
      createdAt: Date.now(),
      triggered: false,
    };

    const smallDrop = evaluateAlertTrigger(alert, {
      symbol: "NVDAc",
      previousLiquidityUsd: 100_000,
      currentLiquidityUsd: 92_000,
    });
    expect(smallDrop.triggered).toBe(false);

    const severeDrop = evaluateAlertTrigger(alert, {
      symbol: "NVDAc",
      previousLiquidityUsd: 100_000,
      currentLiquidityUsd: 78_000, // -22%
    });
    expect(severeDrop.triggered).toBe(true);
    expect(severeDrop.reason).toContain("dropped by 22.0%");
  });

  it("persists and deletes smart alerts correctly", () => {
    const saved = saveSmarterAlert("0x123", {
      type: "whale_swap",
      channel: "in_app",
      targetSymbol: "BRETT",
      thresholdValue: 25_000,
    });

    expect(saved.length).toBe(1);
    expect(saved[0].targetSymbol).toBe("BRETT");

    const reloaded = readSmarterAlerts("0x123");
    expect(reloaded.length).toBe(1);

    const afterDelete = deleteSmarterAlert("0x123", saved[0].id);
    expect(afterDelete.length).toBe(0);
  });
});
