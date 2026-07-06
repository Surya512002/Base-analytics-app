import type { WalletData } from "@/lib/types/wallet";
import {
  computeScoreComponents,
  computeTotalScore,
  computeWalletRank,
  type ScoreComponents,
} from "@/lib/utils/score";
import { maxScoreComponents } from "@/lib/wallet/merge-metrics";

/** Recompute onchain score bars from wallet metrics — fixes stale nftHolder/dexTrading zeros. */
export function reconcileWalletScore(wallet: WalletData): WalletData {
  const ethVol = parseFloat(wallet.ethVolume) || 0;
  const swapVolUsd = Math.max(
    wallet.dexVolumeUSD ?? 0,
    wallet.ethSwapVolumeUSD ?? 0
  );

  const fresh = computeScoreComponents({
    txCount: wallet.txCount,
    uniqueDays: wallet.uniqueDays,
    activeMonths: wallet.activeMonths,
    activeWeeks: wallet.activeWeeks,
    currentStreak: wallet.currentStreak,
    longestStreak: wallet.longestStreak,
    ethVol,
    uniqueTokens: wallet.tokensSwapped,
    defiInteractions: wallet.defiInteractions,
    uniqueContracts: wallet.uniqueContracts,
    nftCount: wallet.nftCount,
    nftTxCount: wallet.erc721Txs,
    dexTradeCount: wallet.dexTradeCount,
    dexVolumeUSD: swapVolUsd,
    ethSwapVolumeUSD: wallet.ethSwapVolumeUSD ?? 0,
    bridgeTxCount: wallet.bridgeTxCount,
    hasBasename: Boolean(wallet.basename),
    gmCount: wallet.gmCount,
    checkInCount: wallet.checkInCount,
  });

  const scoreComponents = wallet.scoreComponents
    ? maxScoreComponents(wallet.scoreComponents, fresh)
    : fresh;

  const score = Math.max(wallet.score, computeTotalScore(scoreComponents));

  return {
    ...wallet,
    scoreComponents,
    score,
    walletRank: computeWalletRank(score),
  };
}
