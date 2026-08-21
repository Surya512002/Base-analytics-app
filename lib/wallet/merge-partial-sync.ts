import type { WalletData } from "@/lib/types/wallet";
import { reconcileWalletScore } from "@/lib/utils/reconcile-score";
import { maxScoreComponents, heatmapActiveDays } from "@/lib/wallet/merge-metrics";

/** Merge incremental history-sync patches without dropping prior activity counts. */
export function applyPartialSyncPatch(
  prev: WalletData,
  address: string,
  patch: Partial<WalletData>
): WalletData {
  const addr = address.toLowerCase();
  if (prev.address.toLowerCase() !== addr) return prev;

  const nextEth = parseFloat(patch.ethVolume ?? prev.ethVolume);
  const prevEth = parseFloat(prev.ethVolume);

  const scoreComponents =
    patch.scoreComponents && prev.scoreComponents
      ? maxScoreComponents(prev.scoreComponents, patch.scoreComponents)
      : patch.scoreComponents ?? prev.scoreComponents;

  const merged: WalletData = {
    ...prev,
    uniqueDays: Math.max(prev.uniqueDays, patch.uniqueDays ?? 0),
    txCount: Math.max(prev.txCount, patch.txCount ?? 0),
    activeWeeks: Math.max(prev.activeWeeks, patch.activeWeeks ?? 0),
    activeMonths: Math.max(prev.activeMonths, patch.activeMonths ?? 0),
    dailyStats:
      heatmapActiveDays(patch.dailyStats) >= heatmapActiveDays(prev.dailyStats) ||
      (patch.uniqueDays ?? 0) >= prev.uniqueDays
        ? (patch.dailyStats ?? prev.dailyStats)
        : prev.dailyStats,
    historyDays: Math.max(prev.historyDays, patch.dailyStats?.length ?? 0),
    tokensSwapped: Math.max(prev.tokensSwapped, patch.tokensSwapped ?? 0),
    erc20Txs: Math.max(prev.erc20Txs, patch.erc20Txs ?? 0),
    nftCount: Math.max(prev.nftCount, patch.nftCount ?? 0),
    erc721Txs: Math.max(prev.erc721Txs, patch.erc721Txs ?? 0),
    swapCount: Math.max(prev.swapCount, patch.swapCount ?? 0),
    dexTradeCount: Math.max(prev.dexTradeCount, patch.dexTradeCount ?? 0),
    dexVolumeUSD: Math.max(prev.dexVolumeUSD, patch.dexVolumeUSD ?? 0),
    dexVolumeETH: Math.max(prev.dexVolumeETH, patch.dexVolumeETH ?? 0),
    dexTradeCount30d: Math.max(prev.dexTradeCount30d, patch.dexTradeCount30d ?? 0),
    dexVolumeUSD30d: Math.max(prev.dexVolumeUSD30d, patch.dexVolumeUSD30d ?? 0),
    ethSwapVolumeUSD: Math.max(prev.ethSwapVolumeUSD ?? 0, patch.ethSwapVolumeUSD ?? 0),
    ethVolume: nextEth > prevEth ? (patch.ethVolume ?? prev.ethVolume) : prev.ethVolume,
    activityScore: Math.max(prev.activityScore, patch.activityScore ?? 0),
    score: Math.max(prev.score, patch.score ?? 0),
    walletRank:
      (patch.score ?? 0) > prev.score
        ? (patch.walletRank ?? prev.walletRank)
        : prev.walletRank,
    bridgeTxCount: Math.max(prev.bridgeTxCount, patch.bridgeTxCount ?? 0),
    defiInteractions: Math.max(prev.defiInteractions, patch.defiInteractions ?? 0),
    uniqueContracts: Math.max(prev.uniqueContracts, patch.uniqueContracts ?? 0),
    scoreComponents,
    recommendation:
      prev.recommendation.includes("Fetching") || prev.recommendation.includes("Syncing")
        ? (patch.recommendation ?? prev.recommendation)
        : prev.recommendation,
    recentTxs:
      patch.recentTxs && patch.recentTxs.length > 0
        ? patch.recentTxs
        : prev.recentTxs,
    topTokens:
      patch.topTokens && patch.topTokens.length > 0 ? patch.topTokens : prev.topTokens,
    firstTx:
      patch.firstTx && patch.firstTx !== "Syncing…" ? patch.firstTx : prev.firstTx,
    lastTx: patch.lastTx && patch.lastTx !== "Syncing…" ? patch.lastTx : prev.lastTx,
    ethReceived: Math.max(prev.ethReceived ?? 0, patch.ethReceived ?? 0),
    netETHFlow: (() => {
      const sent = Math.max(
        parseFloat(prev.ethVolume) || 0,
        parseFloat(patch.ethVolume ?? prev.ethVolume) || 0
      );
      const received = Math.max(prev.ethReceived ?? 0, patch.ethReceived ?? 0);
      return parseFloat((received - sent).toFixed(4));
    })(),
    uniqueProtocols: Math.max(prev.uniqueProtocols ?? 0, patch.uniqueProtocols ?? 0),
    aaTxCount: Math.max(prev.aaTxCount ?? 0, patch.aaTxCount ?? 0),
    paymasterTxCount: Math.max(prev.paymasterTxCount ?? 0, patch.paymasterTxCount ?? 0),
    contractInteractions: Math.max(
      prev.contractInteractions ?? 0,
      patch.contractInteractions ?? 0
    ),
    daysOnBase: Math.max(prev.daysOnBase ?? 0, patch.daysOnBase ?? 0),
  };

  // Re-derive bars + rank from the merged metrics (volume cards and score sidebar stay in sync).
  return reconcileWalletScore(merged);
}
