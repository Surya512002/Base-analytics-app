/** Max points per score dimension (must sum to 100). */
export const SCORE_MAX = {
  txActivity: 14,
  consistency: 12,
  longevity: 10,
  streak: 8,
  volume: 7,
  diversity: 6,
  defiUsage: 5,
  contracts: 8,
  nftHolder: 4,
  dexTrading: 7,
  bridge: 4,
  identity: 5,
  engagement: 5,
  activeWeeks: 5,
} as const;

export const SCORE_LABELS: Record<keyof typeof SCORE_MAX, string> = {
  txActivity: "Activity",
  consistency: "Consistency",
  longevity: "Longevity",
  streak: "Streak",
  volume: "Volume",
  diversity: "Tokens",
  defiUsage: "DeFi",
  contracts: "Contracts",
  nftHolder: "NFTs",
  dexTrading: "DEX",
  bridge: "Bridge",
  identity: "Identity",
  engagement: "Social",
  activeWeeks: "Weeks",
};

export type ScoreComponents = Record<keyof typeof SCORE_MAX, number>;

export interface ScoreInput {
  txCount: number;
  uniqueDays: number;
  activeMonths: number;
  activeWeeks: number;
  currentStreak: number;
  longestStreak: number;
  ethVol: number;
  uniqueTokens: number;
  defiInteractions: number;
  uniqueContracts: number;
  nftCount: number;
  dexTradeCount: number;
  bridgeTxCount: number;
  hasBasename: boolean;
  gmCount: number;
  checkInCount: number;
}

/**
 * Elite-tier scoring — 100 requires excellence across many onchain dimensions.
 * ~50 active days + moderate txs ≈ 8–18 (was ~25–35).
 */
export function computeScoreComponents(input: ScoreInput): ScoreComponents {
  const {
    txCount,
    uniqueDays,
    activeMonths,
    activeWeeks,
    currentStreak,
    longestStreak,
    ethVol,
    uniqueTokens,
    defiInteractions,
    uniqueContracts,
    nftCount,
    dexTradeCount,
    bridgeTxCount,
    hasBasename,
    gmCount,
    checkInCount,
  } = input;

  const streakBasis = Math.max(currentStreak, longestStreak * 0.6);

  return {
    // ~3,500 txs to max
    txActivity: Math.min(SCORE_MAX.txActivity, txCount / 250),
    // ~300 unique active days to max
    consistency: Math.min(SCORE_MAX.consistency, uniqueDays / 25),
    // ~25 active months to max
    longevity: Math.min(SCORE_MAX.longevity, activeMonths * 0.4),
    // ~56-day streak to max
    streak: Math.min(SCORE_MAX.streak, streakBasis / 7),
    // ~6+ ETH sent (sqrt curve)
    volume: Math.min(SCORE_MAX.volume, Math.sqrt(ethVol + 0.001) * 2.8),
    // ~30 unique tokens to max
    diversity: Math.min(SCORE_MAX.diversity, uniqueTokens / 5),
    // ~50 DeFi interactions to max
    defiUsage: Math.min(SCORE_MAX.defiUsage, defiInteractions / 10),
    // ~200 unique contracts to max
    contracts: Math.min(SCORE_MAX.contracts, uniqueContracts / 25),
    // ~20 NFTs held to max
    nftHolder: Math.min(SCORE_MAX.nftHolder, nftCount / 5),
    // ~175 DEX trades to max
    dexTrading: Math.min(SCORE_MAX.dexTrading, dexTradeCount / 25),
    // ~24 bridge txs to max
    bridge: Math.min(SCORE_MAX.bridge, bridgeTxCount / 6),
    // Basename verified identity
    identity: hasBasename ? SCORE_MAX.identity : 0,
    // ~75 GM + check-in txs to max
    engagement: Math.min(SCORE_MAX.engagement, (gmCount + checkInCount) / 15),
    // ~125 active weeks to max
    activeWeeks: Math.min(SCORE_MAX.activeWeeks, activeWeeks / 25),
  };
}

export function computeTotalScore(components: ScoreComponents): number {
  return Math.min(
    100,
    Math.floor(Object.values(components).reduce((a, b) => a + b, 0))
  );
}

export function computeWalletRank(score: number): string {
  if (score >= 85) return "Base God 👑";
  if (score >= 70) return "Base Whale 🐋";
  if (score >= 50) return "Base Shark 🦈";
  if (score >= 30) return "Base Dolphin 🐬";
  return "Base Shrimp 🦐";
}

/** Lightweight challenge lookup (tx list only — partial score). */
export function computeChallengeScore(
  txCount: number,
  uniqueDays: number,
  activeMonths: number,
  activeWeeks = 0
): number {
  return computeTotalScore(
    computeScoreComponents({
      txCount,
      uniqueDays,
      activeMonths,
      activeWeeks,
      currentStreak: 0,
      longestStreak: 0,
      ethVol: 0,
      uniqueTokens: 0,
      defiInteractions: 0,
      uniqueContracts: 0,
      nftCount: 0,
      dexTradeCount: 0,
      bridgeTxCount: 0,
      hasBasename: false,
      gmCount: 0,
      checkInCount: 0,
    })
  );
}
