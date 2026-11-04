import { todayUtcKey } from "@/lib/utils/check-in-status";

function todayTxCounterKey(address: string): string {
  return `base_inapp_txs_${address.toLowerCase()}_${todayUtcKey()}`;
}

function readTodayTxCounter(address: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(localStorage.getItem(todayTxCounterKey(address)) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function notifyPointsUpdated(address: string): void {
  if (typeof window === "undefined" || !address) return;
  try {
    window.dispatchEvent(
      new CustomEvent("base-points-updated", {
        detail: { address: address.toLowerCase() },
      })
    );
  } catch {
    // ignore
  }
}

/** Count a confirmed in-app transaction toward today's activity tally. */
export function recordInAppTransaction(
  address: string,
  opts?: { notify?: boolean }
): number {
  if (!address || typeof window === "undefined") return 0;

  const next = readTodayTxCounter(address) + 1;
  try {
    localStorage.setItem(todayTxCounterKey(address), String(next));
  } catch {
    // quota / private mode
  }

  if (opts?.notify !== false) {
    notifyPointsUpdated(address);
  }
  return next;
}

export function getTodayInAppTxCount(address: string): number {
  if (!address) return 0;
  return readTodayTxCounter(address);
}

/** Record one confirmed wallet action: increment today's tx tally. */
export function recordConfirmedInAppAction(
  address: string,
  _action?: string,
  _nextCount?: number
): { credited: number; hitCap: boolean; txsToday: number } {
  const txsToday = recordInAppTransaction(address, { notify: false });
  notifyPointsUpdated(address);
  return { credited: 0, hitCap: false, txsToday };
}

export function recordCheckInPointsOnce(
  _address: string
): { credited: number; hitCap: boolean } {
  return { credited: 0, hitCap: false };
}

export function tryAwardCheckInWeeklyBonus(
  _address: string,
  _streak: number
): number {
  return 0;
}

export function tryAwardSevenDayAllTasksBonus(
  _address: string,
  _streak: number,
  _doneQuests: number
): number {
  return 0;
}

export function syncActivityPointsFromSession(
  _address: string,
  _txKeys: Record<string, number>,
  _streak: number,
  _checkedToday: boolean,
  _x402PayCount = 0,
  _voucherBatchCount = 0,
  _didChallenge = false
): boolean {
  return false;
}
