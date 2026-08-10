import type { WalletData } from "@/lib/types/wallet";
import {
  computeScoreComponents,
  computeTotalScore,
  computeWalletRank,
  type ScoreComponents,
} from "@/lib/utils/score";

function maxComponents(
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

/** Recompute onchain score bars from wallet metrics — fixes stale volume/swap zeros. */
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
    ? maxComponents(wallet.scoreComponents, fresh)
    : fresh;

  const score = Math.max(wallet.score, computeTotalScore(scoreComponents));

  return {
    ...wallet,
    scoreComponents,
    score,
    walletRank: computeWalletRank(score),
  };
}
