import { SEASON_END, SEASON_START, WEEKLY_QUESTS } from "@/lib/constants/season";
import type { AppQuestContext } from "@/lib/constants/season";
import {
  CHECK_IN_TRACK_DAYS,
  streakBoostPercent,
} from "@/lib/utils/check-in-rewards";
import {
  DAILY_POINTS_CAP,
  getTodayPointsSummary,
  getWeekActivityTotal,
  getWeekStreakTotal,
} from "@/lib/utils/daily-points";
import { getBadgeMintXpTotal } from "@/lib/utils/badge-mint-xp";
import { loadLocalBatches } from "@/lib/utils/voucher";
import type { WalletData } from "@/lib/types/wallet";

export type { AppQuestContext } from "@/lib/constants/season";

export function buildAppQuestContext(args: {
  wallet: WalletData;
  streak: number;
  checkedToday: boolean;
  txKeys: Record<string, number>;
  x402PayCount: number;
  referralInvites: number;
  didChallenge: boolean;
}): AppQuestContext {
  return {
    wallet: args.wallet,
    streak: args.streak,
    checkedToday: args.checkedToday,
    txKeys: args.txKeys,
    x402PayCount: args.x402PayCount,
    voucherBatchCount: loadLocalBatches(args.wallet.address).length,
    referralInvites: args.referralInvites,
    didChallenge: args.didChallenge,
  };
}

export function getQuestXP(ctx: AppQuestContext): number {
  return WEEKLY_QUESTS.filter((q) => q.check(ctx)).reduce(
    (acc, q) => acc + q.xp,
    0
  );
}

export function countDoneQuests(ctx: AppQuestContext): number {
  return WEEKLY_QUESTS.filter((q) => q.check(ctx)).length;
}

export interface XPBreakdown {
  questBase: number;
  questMultiplier: number;
  questXp: number;
  weekActivityXp: number;
  weekStreakXp: number;
  badgeMintXp: number;
  todayActivityXp: number;
  todayStreakXp: number;
  todayBonusXp: number;
  todayTxCount: number;
  dailyCap: number;
  dailyRemaining: number;
  /** Quest + activity for the current week (weekly leaderboard). */
  weeklyTotal: number;
  /** Weekly total + all-time badge mint XP (season leaderboard). */
  seasonTotal: number;
  /** @deprecated Use weeklyTotal or seasonTotal */
  total: number;
}

/** Quest XP + capped daily activity (week sum) + 7-day all-tasks bonus. */
export function computeXPBreakdown(
  ctx: AppQuestContext,
  _boosts: number,
  doneQuests?: number
): XPBreakdown {
  const address = ctx.wallet.address;

  const questBase = getQuestXP(ctx);
  const cycleDay = Math.min(Math.max(ctx.streak, 0), CHECK_IN_TRACK_DAYS);
  const boostPct = streakBoostPercent(cycleDay || 1);
  const questMultiplier = 1 + boostPct / 100;
  const questXp = Math.round(questBase * questMultiplier);

  const weekActivityXp = getWeekActivityTotal(address);
  const weekStreakXp = getWeekStreakTotal(address);
  const badgeMintXp = getBadgeMintXpTotal(address);
  const today = getTodayPointsSummary(address);

  const weeklyTotal = questXp + weekActivityXp + weekStreakXp;
  const seasonTotal = weeklyTotal + badgeMintXp;

  return {
    questBase,
    questMultiplier,
    questXp,
    weekActivityXp,
    weekStreakXp,
    badgeMintXp,
    todayActivityXp: today.activity,
    todayStreakXp: today.streak,
    todayBonusXp: today.bonus,
    todayTxCount: today.txs,
    dailyCap: DAILY_POINTS_CAP,
    dailyRemaining: today.remaining,
    weeklyTotal,
    seasonTotal,
    total: weeklyTotal,
  };
}

export function computeWeeklyXP(
  ctx: AppQuestContext,
  boosts: number,
  doneQuests?: number
): number {
  return computeXPBreakdown(ctx, boosts, doneQuests).weeklyTotal;
}

export function computeSeasonXP(
  ctx: AppQuestContext,
  boosts: number,
  doneQuests?: number
): number {
  return computeXPBreakdown(ctx, boosts, doneQuests).seasonTotal;
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
