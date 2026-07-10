import { describe, expect, it } from "vitest";
import { applyPartialSyncPatch } from "@/lib/wallet/merge-partial-sync";
import type { WalletData } from "@/lib/types/wallet";

function shell(address: string): WalletData {
  return {
    address,
    basename: null,
    balance: "0",
    usdcBalance: "0",
    score: 10,
    walletRank: "Bronze",
    uniqueDays: 5,
    txCount: 20,
    activeWeeks: 2,
    activeMonths: 1,
    dailyStats: [],
    historyDays: 0,
    recommendation: "Syncing…",
    activityScore: 5,
    ethVolume: "0.1",
    dexVolumeUSD: 100,
    dexVolumeETH: 0,
    dexTradeCount: 1,
    dexTradeCount30d: 1,
    dexVolumeUSD30d: 50,
    ethSwapVolumeUSD: 0,
    tokensSwapped: 0,
    erc20Txs: 0,
    nftCount: 0,
    erc721Txs: 0,
    swapCount: 0,
    bridgeTxCount: 0,
    defiInteractions: 0,
    uniqueContracts: 0,
    portfolioValueUSD: 0,
    currentStreak: 0,
    longestStreak: 0,
    firstTx: "",
    lastTx: "",
    daysSinceActive: 0,
    onchainAgePercentile: 0,
    netETHFlow: 0,
    paymasterTxCount: 0,
    gmCount: 0,
    checkInCount: 0,
    walletHealthScore: 0,
    walletHealthLabel: "",
    scoreComponents: {} as WalletData["scoreComponents"],
    weekLabels: [],
    topTokens: [],
    recentTxs: [],
    daysOnBase: 0,
    hasGm: false,
    avgTxPerDay: 0,
    mostActiveMonth: "",
    ethReceived: 0,
    totalGasSpent: 0,
    avgTxValueETH: 0,
    uniqueProtocols: 0,
    longestInactiveDays: 0,
    weeklyTxAvg: 0,
    mostUsedProtocol: "",
    contractInteractions: 0,
    peakDayTxCount: 0,
    peakDayDate: "",
  };
}

describe("applyPartialSyncPatch", () => {
  it("never decreases activity counts", () => {
    const prev = shell("0x1111111111111111111111111111111111111111");
    const next = applyPartialSyncPatch(prev, prev.address, {
      uniqueDays: 12,
      txCount: 45,
      dexVolumeUSD: 500,
      score: 25,
    });
    expect(next.uniqueDays).toBe(12);
    expect(next.txCount).toBe(45);
    expect(next.dexVolumeUSD).toBe(500);
    expect(next.score).toBe(25);
  });

  it("ignores patches for a different address", () => {
    const prev = shell("0x1111111111111111111111111111111111111111");
    const next = applyPartialSyncPatch(prev, "0x2222222222222222222222222222222222222222", {
      uniqueDays: 99,
    });
    expect(next.uniqueDays).toBe(5);
  });
});
