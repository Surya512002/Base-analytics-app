import type { DayStats, WalletData } from "@/lib/types/wallet";
import { computeScoreComponents, computeTotalScore, computeWalletRank } from "@/lib/utils/score";
import { calcWalletHealth } from "@/lib/utils/wallet-health";

function emptyDailyStats(days = 364): DayStats[] {
  const stats: DayStats[] = [];
  const hPtr = new Date();
  for (let i = 0; i < days; i++) {
    stats.unshift({
      date: hPtr.toISOString().slice(0, 10),
      count: 0,
      intensity: 0,
    });
    hPtr.setUTCDate(hPtr.getUTCDate() - 1);
  }
  return stats;
}

/** Minimal wallet row so the app leaves the connect screen while analysis runs. */
export function buildPendingWalletShell(address: string): WalletData {
  const scoreComponents = computeScoreComponents({
    txCount: 0,
    uniqueDays: 0,
    activeMonths: 0,
    activeWeeks: 0,
    currentStreak: 0,
    longestStreak: 0,
    ethVol: 0,
    uniqueTokens: 0,
    defiInteractions: 0,
    uniqueContracts: 0,
    nftCount: 0,
    nftTxCount: 0,
    dexTradeCount: 0,
    dexVolumeUSD: 0,
    ethSwapVolumeUSD: 0,
    bridgeTxCount: 0,
    hasBasename: false,
    gmCount: 0,
    checkInCount: 0,
  });
  const score = computeTotalScore(scoreComponents);
  const health = calcWalletHealth({
    uniqueDays: 0,
    activeMonths: 0,
    currentStreak: 0,
    defiInteractions: 0,
    uniqueContracts: 0,
    txCount: 0,
    nftCount: 0,
    basename: null,
    daysSinceActive: 0,
  });

  return {
    address,
    basename: null,
    balance: "0",
    usdcBalance: "0",
    ethVolume: "0",
    txCount: 0,
    uniqueDays: 0,
    activeWeeks: 0,
    activeMonths: 0,
    currentStreak: 0,
    longestStreak: 0,
    firstTx: "Syncing…",
    lastTx: "Syncing…",
    daysSinceActive: 0,
    tokensSwapped: 0,
    swapCount: 0,
    contractInteractions: 0,
    nftCount: 0,
    walletRank: computeWalletRank(score),
    score: 0,
    historyDays: 364,
    weekLabels: [],
    dailyStats: emptyDailyStats(),
    topTokens: [],
    recommendation: "Fetching onchain data…",
    recentTxs: [],
    daysOnBase: 0,
    defiInteractions: 0,
    hasGm: false,
    uniqueContracts: 0,
    avgTxPerDay: 0,
    mostActiveMonth: "N/A",
    ethReceived: 0,
    totalGasSpent: 0,
    erc20Txs: 0,
    erc721Txs: 0,
    gmCount: 0,
    checkInCount: 0,
    walletHealthScore: health.score,
    walletHealthLabel: health.label,
    scoreComponents,
    portfolioValueUSD: 0,
    dexVolumeETH: 0,
    dexVolumeUSD: 0,
    dexTradeCount: 0,
    dexVolumeUSD30d: 0,
    dexTradeCount30d: 0,
    paymasterTxCount: 0,
    bridgeTxCount: 0,
    netETHFlow: 0,
    avgTxValueETH: 0,
    uniqueProtocols: 0,
    longestInactiveDays: 0,
    weeklyTxAvg: 0,
    onchainAgePercentile: 0,
    mostUsedProtocol: "None",
    activityScore: 0,
    peakDayTxCount: 0,
    peakDayDate: "N/A",
  };
}
