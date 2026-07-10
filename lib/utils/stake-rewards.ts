const STAKE_KEY = "base_xp_stake";

export type XpStakeRecord = {
  amount: number;
  stakedAt: number;
  unlockAt: number;
};

export function readXpStake(): XpStakeRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STAKE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as XpStakeRecord;
    if (!parsed?.amount || !parsed.stakedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function stakeXp(amount: number, lockDays = 7): XpStakeRecord {
  const now = Date.now();
  const record: XpStakeRecord = {
    amount,
    stakedAt: now,
    unlockAt: now + lockDays * 24 * 60 * 60 * 1000,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STAKE_KEY, JSON.stringify(record));
  }
  return record;
}

export function unstakeXp(): XpStakeRecord | null {
  const record = readXpStake();
  if (!record) return null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(STAKE_KEY);
  }
  return record;
}

export function stakeMultiplier(record: XpStakeRecord | null): number {
  if (!record) return 1;
  if (Date.now() > record.unlockAt) return 1;
  if (record.amount >= 500) return 1.5;
  if (record.amount >= 200) return 1.25;
  return 1.1;
}

export function stakeDaysRemaining(record: XpStakeRecord): number {
  const ms = record.unlockAt - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
