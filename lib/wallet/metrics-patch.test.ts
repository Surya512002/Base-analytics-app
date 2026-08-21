import { describe, expect, it } from "vitest";
import { applyHistoryIndexToWallet } from "@/lib/wallet/metrics-patch";
import { emptyHistoryState } from "@/lib/wallet/history-store";
import { applyPartialSyncPatch } from "@/lib/wallet/merge-partial-sync";
import type { WalletData } from "@/lib/types/wallet";

function shell(address: string): WalletData {
  return {
    address,
    basename: null,
    balance: "1.2",
    usdcBalance: "10",
    score: 42,
    walletRank: "Base Builder 🔨",
    uniqueDays: 40,
    txCount: 800,
    activeWeeks: 12,
    activeMonths: 8,
    dailyStats: [{ date: "2026-01-01", count: 3, intensity: 2 }],
    historyDays: 400,
    recommendation: "You're a Base power user! Keep it up.",
    activityScore: 70,
    ethVolume: "6.3965",
    dexVolumeUSD: 23100,
    dexVolumeETH: 7.2,
    dexTradeCount: 1718,
    dexTradeCount30d: 40,
    dexVolumeUSD30d: 1200,
    ethSwapVolumeUSD: 1420,
    tokensSwapped: 18,
    erc20Txs: 200,
    nftCount: 3,
    erc721Txs: 5,
    swapCount: 90,
    bridgeTxCount: 2,
    defiInteractions: 12,
    uniqueContracts: 20,
    portfolioValueUSD: 500,
    currentStreak: 2,
    longestStreak: 9,
    firstTx: "1/1/2024",
    lastTx: "8/16/2026",
    daysSinceActive: 1,
    onchainAgePercentile: 40,
    netETHFlow: -1.2,
    paymasterTxCount: 80,
    aaTxCount: 75,
    gmCount: 4,
    checkInCount: 10,
    walletHealthScore: 70,
    walletHealthLabel: "Healthy",
    scoreComponents: {
      txActivity: 8,
      consistency: 8,
      longevity: 6,
      streak: 2,
      volume: 8,
      diversity: 4,
      defiUsage: 4,
      contracts: 4,
      nftHolder: 2,
      dexTrading: 10,
      bridge: 2,
      identity: 0,
      engagement: 2,
      activeWeeks: 4,
    },
    weekLabels: [],
    topTokens: ["USDC"],
    recentTxs: [],
    daysOnBase: 400,
    hasGm: true,
    avgTxPerDay: 20,
    mostActiveMonth: "Mar 2026",
    ethReceived: 5.1,
    totalGasSpent: 0,
    avgTxValueETH: 0.01,
    uniqueProtocols: 6,
    longestInactiveDays: 12,
    weeklyTxAvg: 30,
    mostUsedProtocol: "Aerodrome",
    contractInteractions: 100,
    peakDayTxCount: 12,
    peakDayDate: "2026-03-01",
  };
}

describe("applyHistoryIndexToWallet", () => {
  it("raises heatmap/tx counts from the stored index without wiping volume", () => {
    const prev = shell("0x1111111111111111111111111111111111111111");
    const state = emptyHistoryState();
    state.txHashes = Array.from({ length: 1200 }, (_, i) => `0x${i}`);
    state.tpd = { "2025-01-01": 2, "2026-08-01": 4 };
    for (let i = 0; i < 90; i++) {
      const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
      state.tpd[d] = 1;
    }
    state.tokenAssets = ["USDC", "WETH", "AERO"];
    state.erc20LegCount = 400;

    const next = applyHistoryIndexToWallet(prev, state);
    expect(next.txCount).toBeGreaterThanOrEqual(1200);
    expect(next.uniqueDays).toBeGreaterThanOrEqual(90);
    expect(next.ethVolume).toBe("6.3965");
    expect(next.dexVolumeUSD).toBe(23100);
    expect(next.aaTxCount).toBe(75);
    expect(next.ethReceived).toBe(5.1);
    expect(next.ethSwapVolumeUSD).toBe(1420);
  });

  it("replaces a thin recent heatmap when the index has more active cells", () => {
    const prev = shell("0x1111111111111111111111111111111111111111");
    prev.uniqueDays = 200;
    prev.dailyStats = [{ date: "2026-08-19", count: 3, intensity: 2 }];
    const state = emptyHistoryState();
    for (let i = 0; i < 90; i++) {
      const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
      state.tpd[d] = 1;
    }
    const next = applyHistoryIndexToWallet(prev, state);
    expect(next.dailyStats.filter((d) => d.count > 0).length).toBeGreaterThan(1);
    expect(next.uniqueDays).toBeGreaterThanOrEqual(90);
  });
});

describe("applyPartialSyncPatch extra fields", () => {
  it("keeps AA / ETH received / swap volume when the burst omits them", () => {
    const prev = shell("0x1111111111111111111111111111111111111111");
    const next = applyPartialSyncPatch(prev, prev.address, {
      uniqueDays: 95,
      txCount: 900,
      dexVolumeUSD: 500,
      ethSwapVolumeUSD: 0,
      aaTxCount: 0,
      ethReceived: 0,
    });
    expect(next.uniqueDays).toBe(95);
    expect(next.dexVolumeUSD).toBe(23100);
    expect(next.ethSwapVolumeUSD).toBe(1420);
    expect(next.aaTxCount).toBe(75);
    expect(next.ethReceived).toBe(5.1);
  });
});
