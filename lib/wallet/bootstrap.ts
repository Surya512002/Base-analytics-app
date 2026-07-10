import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { resolveBasename } from "@/lib/utils/resolve-basename";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import { detectSmartAccount } from "@/lib/wallet/smart-account";
import {
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
} from "@/lib/constants/contracts";
import { computeWalletRank, computeTotalScore, computeScoreComponents } from "@/lib/utils/score";
import { calcWalletHealth } from "@/lib/utils/wallet-health";
import type { AnalyzeWalletResult, DayStats, WalletData } from "@/lib/types/wallet";

/** Fast shell (~3–8s) so Base App / smart wallets unblock before full history sync. */
export async function bootstrapWalletAnalysis(
  address: string
): Promise<AnalyzeWalletResult | null> {
  if (!address?.startsWith("0x") || address.length !== 42) return null;

  const addr = address.toLowerCase();
  const pub = createBasePublicClient();
  const balancesP = fetchWalletBalances(address, 3200);

  const [smart, bn, balances, streakRaw, lastCheckIn] = await Promise.all([
    detectSmartAccount(addr),
    resolveBasename(address).catch(() => null),
    balancesP,
    pub
      .readContract({
        address: CHECKIN_CONTRACT as `0x${string}`,
        abi: CHECKIN_ABI,
        functionName: "streaks",
        args: [address as `0x${string}`],
      })
      .catch(() => BigInt(0)),
    pub
      .readContract({
        address: CHECKIN_CONTRACT as `0x${string}`,
        abi: CHECKIN_ABI,
        functionName: "lastCheckIn",
        args: [address as `0x${string}`],
      })
      .catch(() => BigInt(0)),
  ]);

  const txFloor = Math.max(
    smart.transactionCount,
    smart.isSmartAccount && smart.tokenTransferCount > 0 ? 1 : 0
  );

  const streak = Number(streakRaw);
  let checkedToday = false;
  const lastTs = Number(lastCheckIn);
  if (lastTs > 0) {
    checkedToday =
      new Date(lastTs * 1000).toISOString().slice(0, 10) ===
      new Date().toISOString().slice(0, 10);
  }

  const scoreComponents = computeScoreComponents({
    txCount: txFloor,
    uniqueDays: Math.min(txFloor, 30),
    activeMonths: 1,
    activeWeeks: 1,
    currentStreak: streak,
    longestStreak: streak,
    ethVol: 0,
    uniqueTokens: smart.tokenTransferCount > 0 ? 3 : 0,
    defiInteractions: 0,
    uniqueContracts: 0,
    nftCount: 0,
    nftTxCount: 0,
    dexTradeCount: 0,
    dexVolumeUSD: 0,
    ethSwapVolumeUSD: 0,
    bridgeTxCount: 0,
    hasBasename: Boolean(bn),
    gmCount: 0,
    checkInCount: 0,
  });
  const score = computeTotalScore(scoreComponents);
  const walletRank = computeWalletRank(score);
  const health = calcWalletHealth({
    uniqueDays: 0,
    activeMonths: 0,
    currentStreak: streak,
    defiInteractions: 0,
    uniqueContracts: 0,
    txCount: txFloor,
    nftCount: 0,
    basename: bn,
    daysSinceActive: 0,
  });

  const histDays = 364;
  const dStats: DayStats[] = [];
  const hPtr = new Date();
  for (let i = 0; i < histDays; i++) {
    dStats.unshift({
      date: hPtr.toISOString().slice(0, 10),
      count: 0,
      intensity: 0,
    });
    hPtr.setUTCDate(hPtr.getUTCDate() - 1);
  }

  const wallet: WalletData = {
    address,
    basename: bn,
    balance: balances.eth.toFixed(4),
    usdcBalance: balances.usdc.toFixed(2),
    ethVolume: "0",
    txCount: txFloor,
    uniqueDays: 0,
    activeWeeks: 0,
    activeMonths: 0,
    currentStreak: streak,
    longestStreak: streak,
    firstTx: "Syncing…",
    lastTx: "Syncing…",
    daysSinceActive: 0,
    tokensSwapped: 0,
    swapCount: 0,
    contractInteractions: 0,
    nftCount: 0,
    walletRank,
    score: Math.min(100, score),
    historyDays: histDays,
    weekLabels: [],
    dailyStats: dStats,
    topTokens: [],
    recommendation: smart.isSmartAccount
      ? "Syncing your Base App smart wallet history…"
      : "Syncing onchain history…",
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
    portfolioValueUSD: balances.portfolioValueUSD,
    dexVolumeETH: 0,
    dexVolumeUSD: 0,
    dexTradeCount: 0,
    dexVolumeUSD30d: 0,
    dexTradeCount30d: 0,
    paymasterTxCount: smart.isSmartAccount ? Math.max(1, txFloor) : 0,
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

  return {
    wallet,
    mintedLevels: {},
    boosts: 0,
    streak,
    checkedToday,
    historyComplete: false,
  };
}
