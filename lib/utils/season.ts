import { SEASON_END, SEASON_START, WEEKLY_QUESTS } from "@/lib/constants/season";
import type { WalletData } from "@/lib/types/wallet";

export function getQuestXP(
  w: WalletData,
  b: number,
  s: number,
  k?: Record<string, number>
): number {
  return WEEKLY_QUESTS.filter((q) => q.check(w, b, s, k)).reduce(
    (acc, q) => acc + q.xp,
    0
  );
}

function streakQuestMultiplier(streak: number): number {
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/** Weekly quest XP + boost/streak bonuses. Referral XP is tracked separately. */
export function computeWeeklyXP(
  w: WalletData,
  b: number,
  s: number,
  k?: Record<string, number>
): number {
  const questXp = getQuestXP(w, b, s, k);
  const multipliedQuest = Math.round(questXp * streakQuestMultiplier(s));
  return multipliedQuest + Math.min(b, 10) * 10 + Math.min(s, 7) * 5;
}

export function getSeasonPct(): number {
  const now = new Date();
  if (now < SEASON_START) return 0;
  if (now > SEASON_END) return 100;
  return Math.round(
    ((now.getTime() - SEASON_START.getTime()) /
      (SEASON_END.getTime() - SEASON_START.getTime())) *
      100
  );
}

export function getDaysLeft(): number {
  const now = new Date();
  if (now > SEASON_END) return 0;
  return Math.max(
    0,
    Math.ceil((SEASON_END.getTime() - now.getTime()) / 86400000)
  );
}
