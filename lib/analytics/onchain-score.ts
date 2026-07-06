import {
  computeScoreComponents,
  computeTotalScore,
  computeWalletRank,
  type ScoreInput,
  type ScoreComponents,
} from "@/lib/utils/score";
import type { EthFlowVolumes, SwapVolumeMetrics } from "@/lib/utils/swap-volume";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";

export interface OnchainScoreBundle {
  scoreComponents: ScoreComponents;
  score: number;
  walletRank: string;
}

/** Single source of truth for onchain score from analyzed metrics. */
export function buildOnchainScore(input: ScoreInput): OnchainScoreBundle {
  const scoreComponents = computeScoreComponents(input);
  const score = Math.min(100, computeTotalScore(scoreComponents));
  return {
    scoreComponents,
    score,
    walletRank: computeWalletRank(score),
  };
}

export interface VolumeSummary {
  ethSent: number;
  ethReceived: number;
  ethSwapSent: number;
  swapVolumeUsd: number;
  ethSwapVolumeUsd: number;
  swapTxCount: number;
  ethUsd: number;
}

export function buildVolumeSummary(
  flow: EthFlowVolumes,
  swaps: SwapVolumeMetrics,
  ethUsd: number
): VolumeSummary {
  return {
    ethSent: flow.ethSent,
    ethReceived: flow.ethReceived,
    ethSwapSent: flow.ethSwapSent,
    swapVolumeUsd: swaps.totalSwapVolumeUSD,
    ethSwapVolumeUsd: swaps.ethSwapVolumeUSD,
    swapTxCount: swaps.dexTradeCount,
    ethUsd,
  };
}

/** Human-readable swap vs ETH sent (for dashboard). */
export function formatVolumeSummary(summary: VolumeSummary): {
  ethSentLabel: string;
  swapVolumeLabel: string;
  ethSwapLabel: string;
  swapTxLabel: string;
  consistent: boolean;
} {
  const ethSentUsd = summary.ethSent * summary.ethUsd;
  const swapUsd = summary.swapVolumeUsd;
  // Swap volume should track ETH swap legs — flag when wildly below ETH sent on active wallets
  const consistent =
    summary.ethSwapSent <= 0 ||
    swapUsd >= summary.ethSwapSent * summary.ethUsd * 0.5;

  return {
    ethSentLabel: `${summary.ethSent.toFixed(4)} Ξ`,
    swapVolumeLabel: formatDexVolumeUsd(swapUsd),
    ethSwapLabel: formatDexVolumeUsd(summary.ethSwapVolumeUsd),
    swapTxLabel: summary.swapTxCount.toLocaleString(),
    consistent,
  };
}
