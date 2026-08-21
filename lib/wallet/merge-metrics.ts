import type { WalletData } from "@/lib/types/wallet";
import { reconcileWalletScore } from "@/lib/utils/reconcile-score";
import { hasIndexedLastActivity } from "@/lib/wallet/last-activity";
import {
  computeTotalScore,
  computeWalletRank,
  type ScoreComponents,
} from "@/lib/utils/score";

export function maxScoreComponents(
  a: ScoreComponents,
  b: ScoreComponents
): ScoreComponents {
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
  ]) as Set<keyof ScoreComponents>;
  const out = { ...a };
  for (const k of keys) {
    out[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return out;
}

function isShellWallet(w: WalletData): boolean {
  return !hasIndexedLastActivity(w);
}

/** Reject partial quick snapshots that would crush swap/volume score for active wallets. */
function isDegradedMetricsSnapshot(prior: WalletData, next: WalletData): boolean {
  if (isShellWallet(prior)) return false;
  if (activeDaysInStats(next.dailyStats) > activeDaysInStats(prior.dailyStats)) {
    return false;
  }
  if ((next.uniqueDays ?? 0) > (prior.uniqueDays ?? 0)) return false;
  const priorEth = parseFloat(prior.ethVolume) || 0;
  const nextEth = parseFloat(next.ethVolume) || 0;
  const priorSwap = prior.dexVolumeUSD ?? 0;
  const nextSwap = next.dexVolumeUSD ?? 0;
  if (next.score < prior.score - 5) return true;
  if (priorEth > 1 && nextEth < priorEth * 0.4) return true;
  if (priorSwap > 1000 && nextSwap < priorSwap * 0.4) return true;
  return false;
}

function activeDaysInStats(stats: WalletData["dailyStats"] | undefined): number {
  return stats?.filter((d) => d.count > 0).length ?? 0;
}

export function heatmapActiveDays(stats: WalletData["dailyStats"] | undefined): number {
  return activeDaysInStats(stats);
}

/** Merge metrics — keep best counts; never let a thin resync replace a rich snapshot. */
export function mergeWalletMetricsMax(
  prior: WalletData,
  next: WalletData
): WalletData {
  if (isShellWallet(prior)) return reconcileWalletScore(next);
  if (isDegradedMetricsSnapshot(prior, next)) {
    return reconcileWalletScore({
      ...prior,
      basename: next.basename || prior.basename,
      checkInCount: Math.max(prior.checkInCount, next.checkInCount),
    });
  }

  const priorHeatmapDays = activeDaysInStats(prior.dailyStats);
  const nextHeatmapDays = activeDaysInStats(next.dailyStats);
  const usePriorHeatmap =
    priorHeatmapDays > nextHeatmapDays ||
    (priorHeatmapDays === nextHeatmapDays && prior.uniqueDays > next.uniqueDays);
  const priorBal = parseFloat(prior.balance || "0");
  const nextBal = parseFloat(next.balance || "0");

  const scoreComponents = maxScoreComponents(
    prior.scoreComponents,
    next.scoreComponents
  );
  const score = Math.max(
    prior.score,
    next.score,
    computeTotalScore(scoreComponents)
  );

  return reconcileWalletScore({
    ...next,
    basename: next.basename || prior.basename,
    balance:
      priorBal > 0 && (nextBal <= 0 || nextBal < priorBal * 0.45)
        ? prior.balance
        : nextBal > priorBal
          ? next.balance
          : prior.balance || next.balance,
    usdcBalance:
      parseFloat(prior.usdcBalance || "0") >
      parseFloat(next.usdcBalance || "0")
        ? prior.usdcBalance
        : next.usdcBalance ?? prior.usdcBalance,
    portfolioValueUSD:
      prior.portfolioValueUSD > 0 && next.portfolioValueUSD <= 0
        ? prior.portfolioValueUSD
        : Math.max(prior.portfolioValueUSD, next.portfolioValueUSD),
    uniqueDays: Math.max(
      prior.uniqueDays,
      next.uniqueDays,
      usePriorHeatmap ? priorHeatmapDays : nextHeatmapDays
    ),
    txCount: Math.max(prior.txCount, next.txCount),
    activeWeeks: Math.max(prior.activeWeeks, next.activeWeeks),
    activeMonths: Math.max(prior.activeMonths, next.activeMonths),
    dailyStats: usePriorHeatmap ? prior.dailyStats : next.dailyStats,
    tokensSwapped: Math.max(prior.tokensSwapped, next.tokensSwapped),
    erc20Txs: Math.max(prior.erc20Txs, next.erc20Txs),
    swapCount: Math.max(prior.swapCount, next.swapCount),
    dexTradeCount: Math.max(prior.dexTradeCount, next.dexTradeCount),
    dexVolumeUSD: Math.max(prior.dexVolumeUSD, next.dexVolumeUSD),
    dexVolumeETH: Math.max(prior.dexVolumeETH, next.dexVolumeETH),
    ethSwapVolumeUSD: Math.max(
      prior.ethSwapVolumeUSD ?? 0,
      next.ethSwapVolumeUSD ?? 0
    ),
    dexTradeCount30d: Math.max(prior.dexTradeCount30d, next.dexTradeCount30d),
    dexVolumeUSD30d: Math.max(prior.dexVolumeUSD30d, next.dexVolumeUSD30d),
    nftCount: Math.max(prior.nftCount, next.nftCount),
    erc721Txs: Math.max(prior.erc721Txs, next.erc721Txs),
    ethVolume:
      parseFloat(prior.ethVolume) > parseFloat(next.ethVolume)
        ? prior.ethVolume
        : next.ethVolume,
    scoreComponents,
    score,
    walletRank: computeWalletRank(score),
    activityScore: Math.max(prior.activityScore, next.activityScore),
    currentStreak: Math.max(prior.currentStreak, next.currentStreak),
    longestStreak: Math.max(prior.longestStreak, next.longestStreak),
    checkInCount: Math.max(prior.checkInCount, next.checkInCount),
    gmCount: Math.max(prior.gmCount, next.gmCount),
    defiInteractions: Math.max(prior.defiInteractions, next.defiInteractions),
    uniqueContracts: Math.max(prior.uniqueContracts, next.uniqueContracts),
    bridgeTxCount: Math.max(prior.bridgeTxCount, next.bridgeTxCount),
    paymasterTxCount: hasIndexedLastActivity(next)
      ? Math.min(next.paymasterTxCount ?? 0, next.aaTxCount ?? 0)
      : Math.max(prior.paymasterTxCount ?? 0, next.paymasterTxCount ?? 0),
    aaTxCount: hasIndexedLastActivity(next)
      ? (next.aaTxCount ?? 0)
      : Math.max(prior.aaTxCount ?? 0, next.aaTxCount ?? 0),
    ethReceived: Math.max(prior.ethReceived ?? 0, next.ethReceived ?? 0),
    netETHFlow: (() => {
      const sent = Math.max(
        parseFloat(prior.ethVolume) || 0,
        parseFloat(next.ethVolume) || 0
      );
      const received = Math.max(prior.ethReceived ?? 0, next.ethReceived ?? 0);
      return parseFloat((received - sent).toFixed(4));
    })(),
    uniqueProtocols: Math.max(prior.uniqueProtocols ?? 0, next.uniqueProtocols ?? 0),
    contractInteractions: Math.max(
      prior.contractInteractions ?? 0,
      next.contractInteractions ?? 0
    ),
    daysOnBase: Math.max(prior.daysOnBase ?? 0, next.daysOnBase ?? 0),
    onchainAgePercentile: Math.max(
      prior.onchainAgePercentile ?? 0,
      next.onchainAgePercentile ?? 0
    ),
    walletHealthScore: Math.max(prior.walletHealthScore, next.walletHealthScore),
    avgTxPerDay: Math.max(prior.avgTxPerDay ?? 0, next.avgTxPerDay ?? 0),
    weeklyTxAvg: Math.max(prior.weeklyTxAvg ?? 0, next.weeklyTxAvg ?? 0),
    peakDayTxCount: Math.max(prior.peakDayTxCount ?? 0, next.peakDayTxCount ?? 0),
    mostUsedProtocol:
      (next.uniqueProtocols ?? 0) >= (prior.uniqueProtocols ?? 0)
        ? next.mostUsedProtocol || prior.mostUsedProtocol
        : prior.mostUsedProtocol || next.mostUsedProtocol,
  });
}
