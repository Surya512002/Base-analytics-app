import type { WalletData } from "@/lib/types/wallet";

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

  return {
    ...prev,
    uniqueDays: Math.max(prev.uniqueDays, patch.uniqueDays ?? 0),
    txCount: Math.max(prev.txCount, patch.txCount ?? 0),
    activeWeeks: Math.max(prev.activeWeeks, patch.activeWeeks ?? 0),
    activeMonths: Math.max(prev.activeMonths, patch.activeMonths ?? 0),
    dailyStats:
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
    walletRank: (patch.score ?? 0) > prev.score ? (patch.walletRank ?? prev.walletRank) : prev.walletRank,
    bridgeTxCount: Math.max(prev.bridgeTxCount, patch.bridgeTxCount ?? 0),
    defiInteractions: Math.max(prev.defiInteractions, patch.defiInteractions ?? 0),
    uniqueContracts: Math.max(prev.uniqueContracts, patch.uniqueContracts ?? 0),
    recommendation:
      prev.recommendation.includes("Fetching") || prev.recommendation.includes("Syncing")
        ? (patch.recommendation ?? prev.recommendation)
        : prev.recommendation,
  };
}
