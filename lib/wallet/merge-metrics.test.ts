import { describe, expect, it } from "vitest";
import { mergeWalletMetricsMax } from "@/lib/wallet/merge-metrics";
import type { AlchemyTransfer, WalletData } from "@/lib/types/wallet";

const TX: AlchemyTransfer = {
  hash: "0xabc",
  category: "external",
  value: 0.1,
  asset: "ETH",
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  metadata: { blockTimestamp: "2026-08-19T00:00:00.000Z" },
};

function base(over: Partial<WalletData> = {}): WalletData {
  return {
    address: "0x1111111111111111111111111111111111111111",
    basename: null,
    balance: "0",
    usdcBalance: "0",
    score: 40,
    walletRank: "Base Builder 🔨",
    uniqueDays: 5,
    txCount: 12,
    activeWeeks: 2,
    activeMonths: 1,
    dailyStats: [{ date: "2026-08-19", count: 2, intensity: 1 }],
    historyDays: 30,
    recommendation: "You're a Base power user! Keep it up.",
    activityScore: 20,
    ethVolume: "0.4",
    dexVolumeUSD: 10,
    dexVolumeETH: 0.01,
    dexTradeCount: 1,
    dexTradeCount30d: 1,
    dexVolumeUSD30d: 10,
    tokensSwapped: 1,
    erc20Txs: 2,
    nftCount: 0,
    erc721Txs: 0,
    swapCount: 1,
    bridgeTxCount: 0,
    defiInteractions: 0,
    uniqueContracts: 2,
    portfolioValueUSD: 0,
    currentStreak: 0,
    longestStreak: 0,
    firstTx: "8/1/2026",
    lastTx: "8/19/2026",
    daysSinceActive: 0,
    onchainAgePercentile: 10,
    netETHFlow: 0,
    paymasterTxCount: 0,
    aaTxCount: 0,
    gmCount: 0,
    checkInCount: 0,
    walletHealthScore: 40,
    walletHealthLabel: "Healthy",
    scoreComponents: {
      txActivity: 4,
      consistency: 2,
      longevity: 2,
      streak: 0,
      volume: 1,
      diversity: 1,
      defiUsage: 0,
      contracts: 1,
      nftHolder: 0,
      dexTrading: 1,
      bridge: 0,
      identity: 0,
      engagement: 0,
      activeWeeks: 1,
    },
    weekLabels: [],
    topTokens: [],
    recentTxs: [TX],
    daysOnBase: 20,
    hasGm: false,
    avgTxPerDay: 1,
    mostActiveMonth: "Aug 2026",
    ethReceived: 0,
    totalGasSpent: 0,
    avgTxValueETH: 0,
    uniqueProtocols: 1,
    longestInactiveDays: 0,
    weeklyTxAvg: 2,
    mostUsedProtocol: "None",
    contractInteractions: 2,
    peakDayTxCount: 2,
    peakDayDate: "2026-08-19",
    ...over,
  };
}

describe("mergeWalletMetricsMax AA counts", () => {
  it("drops fake bootstrap AA when the next snapshot has last activity", () => {
    const prior = base({
      recommendation: "Syncing onchain history…",
      lastTx: "Syncing…",
      firstTx: "Syncing…",
      recentTxs: [],
      aaTxCount: 80,
      paymasterTxCount: 80,
      txCount: 80,
      score: 12,
    });
    const next = base({
      aaTxCount: 0,
      paymasterTxCount: 0,
      txCount: 14,
      score: 41,
    });
    const merged = mergeWalletMetricsMax(prior, next);
    expect(merged.aaTxCount).toBe(0);
    expect(merged.paymasterTxCount).toBe(0);
  });

  it("does not force Base App / gasless to equal AA", () => {
    const prior = base({
      aaTxCount: 80,
      paymasterTxCount: 80,
    });
    const next = base({
      aaTxCount: 4,
      paymasterTxCount: 1,
      score: 45,
    });
    const merged = mergeWalletMetricsMax(prior, next);
    expect(merged.aaTxCount).toBe(4);
    expect(merged.paymasterTxCount).toBe(1);
  });

  it("keeps the heatmap with more active days", () => {
    const prior = base({
      uniqueDays: 4,
      dailyStats: [
        { date: "2026-08-16", count: 1, intensity: 1 },
        { date: "2026-08-17", count: 1, intensity: 1 },
        { date: "2026-08-18", count: 1, intensity: 1 },
        { date: "2026-08-19", count: 2, intensity: 1 },
      ],
    });
    const next = base({
      uniqueDays: 8,
      score: 48,
      dailyStats: [
        { date: "2026-08-12", count: 1, intensity: 1 },
        { date: "2026-08-13", count: 1, intensity: 1 },
        { date: "2026-08-14", count: 1, intensity: 1 },
        { date: "2026-08-15", count: 1, intensity: 1 },
        { date: "2026-08-16", count: 1, intensity: 1 },
        { date: "2026-08-17", count: 1, intensity: 1 },
        { date: "2026-08-18", count: 1, intensity: 1 },
        { date: "2026-08-19", count: 2, intensity: 1 },
      ],
    });
    const merged = mergeWalletMetricsMax(prior, next);
    expect(merged.dailyStats.filter((d) => d.count > 0)).toHaveLength(8);
    expect(merged.uniqueDays).toBeGreaterThanOrEqual(8);
  });
});
