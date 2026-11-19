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

export function evaluate(def: DropDefinition, results: Record<string, { status: string }>): Evaluation {
  const passed = (t: TaskSpec) => results[t.id]?.status === "passed";
  const missing: string[] = [];

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
