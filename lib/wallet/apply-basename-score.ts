import type { WalletData } from "@/lib/types/wallet";
import {
  computeTotalScore,
  computeWalletRank,
  SCORE_MAX,
  type ScoreComponents,
} from "@/lib/utils/score";

/** Add identity points when basename resolves after the main analyze. */
export function applyBasenameScore(
  wallet: WalletData,
  basename: string
): WalletData {
  if (!basename) return wallet;
  const components = {
    ...wallet.scoreComponents,
    identity: SCORE_MAX.identity,
  } as ScoreComponents;
  const score = Math.max(
    wallet.score,
    computeTotalScore(components)
  );
  return {
    ...wallet,
    basename,
    scoreComponents: components,
    score,
    walletRank: computeWalletRank(score),
  };
}
