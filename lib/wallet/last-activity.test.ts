import { describe, expect, it } from "vitest";
import { hasIndexedLastActivity } from "@/lib/wallet/last-activity";
import type { WalletData } from "@/lib/types/wallet";

function base(over: Partial<WalletData> = {}): WalletData {
  return {
    address: "0x1111111111111111111111111111111111111111",
    basename: null,
    balance: "0",
    usdcBalance: "0",
    score: 0,
    walletRank: "Base Shrimp 🦐",
    uniqueDays: 0,
    txCount: 0,
    activeWeeks: 0,
    activeMonths: 0,
    dailyStats: [],
    historyDays: 0,
    recommendation: "You're a Base power user! Keep it up.",
    activityScore: 0,
    ethVolume: "0",
    dexVolumeUSD: 0,
    dexVolumeETH: 0,
    dexTradeCount: 0,
    dexTradeCount30d: 0,
    dexVolumeUSD30d: 0,
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
    firstTx: "N/A",
    lastTx: "N/A",
    daysSinceActive: 0,
    onchainAgePercentile: 0,
    netETHFlow: 0,
    paymasterTxCount: 0,
    aaTxCount: 0,
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
    ...over,
  };
}

describe("hasIndexedLastActivity", () => {
  it("rejects bootstrap shells still syncing last tx", () => {
    expect(
      hasIndexedLastActivity(
        base({
          lastTx: "Syncing…",
          firstTx: "Syncing…",
          recommendation: "Syncing onchain history…",
          score: 12,
          txCount: 40,
        })
      )
    ).toBe(false);
  });

  it("accepts a scored wallet with recent activity", () => {
    expect(
      hasIndexedLastActivity(
        base({
          lastTx: "8/19/2026",
          recentTxs: [
            {
              hash: "0xabc",
              category: "external",
              value: 0.1,
              asset: "ETH",
              to: "0x1",
              from: "0x1111111111111111111111111111111111111111",
              metadata: { blockTimestamp: "2026-08-19T10:00:00.000Z" },
            },
          ],
          txCount: 12,
          uniqueDays: 4,
          score: 22,
        })
      )
    ).toBe(true);
  });

  it("accepts a completed empty-wallet scan", () => {
    expect(
      hasIndexedLastActivity(
        base({
          lastTx: "N/A",
          txCount: 0,
          uniqueDays: 0,
          recommendation: "Welcome to Base! Try minting an NFT or boosting your score.",
        })
      )
    ).toBe(true);
  });
});
