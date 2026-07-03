import type { AnalyzeWalletResult, WalletData } from "@/lib/types/wallet";
import { SCORE_MAX } from "@/lib/utils/score";

const emptyScoreComponents = Object.fromEntries(
  Object.keys(SCORE_MAX).map((k) => [k, 0])
) as WalletData["scoreComponents"];

/** Minimal wallet snapshot so the app opens instantly before the full onchain scan finishes. */
export function createPlaceholderWallet(address: string): WalletData {
  return {
    address,
    basename: null,
    balance: "0",
    ethVolume: "0",
    txCount: 0,
    uniqueDays: 0,
    activeWeeks: 0,
    activeMonths: 0,
    currentStreak: 0,
    longestStreak: 0,
    firstTx: "—",
    lastTx: "—",
    daysSinceActive: 0,
    tokensSwapped: 0,
    swapCount: 0,
    contractInteractions: 0,
    nftCount: 0,
    walletRank: "Syncing…",
    score: 0,
    historyDays: 0,
    weekLabels: [],
    dailyStats: [],
    topTokens: [],
    recommendation: "Syncing your onchain profile…",
    recentTxs: [],
    daysOnBase: 0,
    defiInteractions: 0,
    hasGm: false,
    uniqueContracts: 0,
    avgTxPerDay: 0,
    mostActiveMonth: "—",
    ethReceived: 0,
    totalGasSpent: 0,
    erc20Txs: 0,
    erc721Txs: 0,
    gmCount: 0,
    checkInCount: 0,
    walletHealthScore: 0,
    walletHealthLabel: "Syncing",
    scoreComponents: emptyScoreComponents,
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
    mostUsedProtocol: "—",
    activityScore: 0,
    peakDayTxCount: 0,
    peakDayDate: "—",
  };
}

export function createPlaceholderAnalysis(address: string): AnalyzeWalletResult {
  return {
    wallet: createPlaceholderWallet(address),
    mintedLevels: {},
    boosts: 0,
    streak: 0,
    checkedToday: false,
  };
}
