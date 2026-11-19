/**
 * Rules engine: which tasks count, whether a wallet is eligible, and how much it gets.
 * Pure functions — no I/O — so they're easy to test.
 */
import type { DropDefinition, StoredTaskResult, TaskSpec, WalletProgress } from "./types";

/** How long a passed result stays valid if the task isn't re-checked at claim. */
export const RESULT_TTL_SEC = 7 * 24 * 3600;

/** Results that still count for the wallet's next claim (`claimIndex` = claims so far). */
export function currentResults(
  def: DropDefinition,
  progress: WalletProgress | null,
  claimIndex: number,
  now: number
): Record<string, StoredTaskResult> {
  const out: Record<string, StoredTaskResult> = {};
  if (!progress) return out;
  for (const task of def.tasks) {
    const r = progress.results[task.id];
    if (!r) continue;
    if (task.repeat && r.claimIndex !== claimIndex) continue; // done for an earlier claim
    if (now - r.at > RESULT_TTL_SEC) continue;
    out[task.id] = r;
  }
  return out;
}

export interface Evaluation {
  eligible: boolean;
  points: number;
  /** Tasks (or "any of" groups) still blocking the claim. */
  missing: string[];
  /** Amount from tiers in base units; "0" = the drop's default amount. */
  amount: string;
}

export function evaluate(def: DropDefinition & { noTaskToday?: boolean }, results: Record<string, { status: string }>): Evaluation {
  const passed = (t: TaskSpec) => results[t.id]?.status === "passed";
  const missing: string[] = [];
  if (def.noTaskToday) missing.push("schedule:no-task-today");

  const groups = new Map<string, TaskSpec[]>();
  for (const t of def.tasks) {
    if (!t.required) continue;
    if (t.group) {
      const g = groups.get(t.group) ?? [];
      g.push(t);
      groups.set(t.group, g);
    } else if (!passed(t)) {
      missing.push(t.id);
    }
  }
  for (const [name, tasks] of groups) {
    if (!tasks.some(passed)) missing.push(`group:${name}`);
  }

  const points = def.tasks.reduce((sum, t) => sum + (passed(t) ? t.points : 0), 0);
  if (def.minPoints !== undefined && points < def.minPoints) missing.push(`points:${def.minPoints}`);

  let amount = "0";
  for (const tier of [...(def.tiers ?? [])].sort((a, b) => a.minPoints - b.minPoints)) {
    if (points >= tier.minPoints) amount = tier.amount;
  }

  return { eligible: missing.length === 0, points, missing, amount };
}

// ───────────────────────────── daily schedule ─────────────────────────────

export const DAY_SEC = 86_400;

/** Unix second the drop's clock starts: when it opens (or was created, if it opens right away). */
export function dropStart(drop: { createdAt: number; unlockAt: number }): number {
  return Math.max(drop.createdAt, drop.unlockAt || 0);
}

/** 1-based day of the drop (day 1 = the first 24h after it opens). 0 before it opens. */
export function dropDay(start: number, now: number): number {
  return now < start ? 0 : Math.floor((now - start) / DAY_SEC) + 1;
}

/** Whether a task counts on this day ("every day" when it has no day window). */
export function taskActiveOnDay(t: TaskSpec, day: number): boolean {
  return !t.days || (day >= t.days.from && day <= t.days.to);
}

/**
 * The definition as it applies right now: only the tasks active today. When a definition has
 * tasks but none are active today, nothing can be claimed ("No task for today").
 */
export function activeDefinition(def: DropDefinition, start: number, now: number): DropDefinition & { noTaskToday: boolean } {
  const day = dropDay(start, now);
  const tasks = def.tasks.filter((t) => taskActiveOnDay(t, Math.max(1, day)));
  return { ...def, tasks, noTaskToday: def.tasks.length > 0 && tasks.length === 0 };
}
