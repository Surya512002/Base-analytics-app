import { TIER_GRADIENTS } from "@/lib/constants/season";
import { ACHIEVEMENTS } from "@/lib/constants/season";

export function getLevelStyle(
  level: number,
  isMinted: boolean,
  isEarned: boolean
): string {
  if (!isEarned) return "bg-white/5 border border-white/8 text-white/15 opacity-40";
  const t = Math.min(level, 5) - 1;
  const b = `bg-linear-to-br ${TIER_GRADIENTS[t]} border border-white/20 text-white`;
  if (isMinted) {
    return `${b} ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0a0f1e] shadow-lg shadow-blue-400/20`;
  }
  return `${b} opacity-75 border-dashed`;
}

export function getTargetTokenId(
  baseId: number,
  num: number,
  level: number
): number {
  return num === 1 ? baseId + 5 : baseId + level;
}

export function getCatValue(
  wallet: { score: number; daysOnBase: number; basename: string | null; uniqueDays: number; contractInteractions: number; ethVolume: string; txCount: number; swapCount: number; nftCount: number; longestStreak: number },
  boosts: number,
  id: string
): number {
  const m: Record<string, number> = {
    score: wallet.score,
    age: wallet.daysOnBase,
    name: wallet.basename ? 1 : 0,
    days: wallet.uniqueDays,
    contract: wallet.contractInteractions,
    volume: parseFloat(wallet.ethVolume),
    txs: wallet.txCount,
    swaps: wallet.swapCount,
    nfts: wallet.nftCount,
    streak: wallet.longestStreak,
    boosts,
  };
  return m[id] ?? 0;
}

/** Total badge tiers across all achievement categories (e.g. 51). */
export function totalAchievementTiers(): number {
  return ACHIEVEMENTS.reduce((n, c) => n + c.thresholds.length, 0);
}

/** Sum of minted tier levels — each category stores highest minted level (1–5). */
export function sumMintedBadges(mintedLevels: Record<string, number>): number {
  return Object.values(mintedLevels).reduce((sum, level) => sum + (level > 0 ? level : 0), 0);
}

/** Collection completion 0–100 based on individual badges minted vs total tiers. */
export function mintedCollectionPct(mintedLevels: Record<string, number>): number {
  const total = totalAchievementTiers();
  if (total <= 0) return 0;
  return Math.round((sumMintedBadges(mintedLevels) / total) * 100);
}
