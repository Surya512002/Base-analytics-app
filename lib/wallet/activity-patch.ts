import type { DayStats } from "@/lib/types/wallet";
import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  type StoredWalletHistory,
  uniqueDaysFromState,
} from "@/lib/wallet/history-store";
import { rollupWalletActivity } from "@/lib/utils/wallet-activity";
import { buildDailyStatsFromState } from "@/lib/wallet/sync-engine";
import { getWeekKey, getMonthKey } from "@/lib/utils/dates";

function weeksMonthsFromDays(days: string[]): {
  activeWeeks: number;
  activeMonths: number;
} {
  const weeks = new Set<string>();
  const months = new Set<string>();
  for (const d of days) {
    weeks.add(getWeekKey(`${d}T12:00:00Z`));
    months.add(getMonthKey(`${d}T12:00:00Z`));
  }
  return { activeWeeks: weeks.size, activeMonths: months.size };
}

/** Fast stats for in-progress sync — heatmap + active days without slow RPC. */
export function buildActivityPatch(
  transfers: AlchemyTransfer[],
  address: string,
  stored?: StoredWalletHistory | null
): {
  uniqueDays: number;
  txCount: number;
  activeWeeks: number;
  activeMonths: number;
  dailyStats: DayStats[];
} {
  if (stored && Object.keys(stored.tpd).length > 0) {
    const { activeWeeks, activeMonths } = weeksMonthsFromDays(
      Object.entries(stored.tpd)
        .filter(([, c]) => c > 0)
        .map(([d]) => d)
    );
    return {
      uniqueDays: uniqueDaysFromState(stored),
      txCount: stored.txHashes.length,
      activeWeeks,
      activeMonths,
      dailyStats: buildDailyStatsFromState(stored),
    };
  }

  const activity = rollupWalletActivity(transfers, address);
  const { uDays, uWeeks, uMonths, tpd, participatingHashes } = activity;

  const now = new Date();
  const histDays = 364;
  const dStats: DayStats[] = [];
  const hPtr = new Date(now);
  for (let i = 0; i < histDays; i++) {
    const ds = hPtr.toISOString().slice(0, 10);
    const c = tpd.get(ds) || 0;
    let intensity = 0;
    if (c > 0) intensity = 1;
    if (c > 2) intensity = 2;
    if (c > 5) intensity = 3;
    if (c > 10) intensity = 4;
    dStats.unshift({ date: ds, count: c, intensity });
    hPtr.setUTCDate(hPtr.getUTCDate() - 1);
  }

  return {
    uniqueDays: uDays.size,
    txCount: participatingHashes.size,
    activeWeeks: uWeeks.size,
    activeMonths: uMonths.size,
    dailyStats: dStats,
  };
}
