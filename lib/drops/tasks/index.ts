/**
 * Every task type a creator can add. Adding a type = one file + one line here. No contract
 * change and no migration: definitions store `{ type, config }` and old types keep working.
 */
import type { TaskType } from "../types";
import { contractReadTask, tokenBalanceTask } from "./onchain";
import { heldSinceTask, tokenBoughtTask } from "./trading";
import { farcasterAccountTask, farcasterChannelTask, farcasterFollowTask, farcasterReactionTask } from "./farcaster";
import { xPostTask } from "./social-proof";
import { quizTask, secretWordTask } from "./answers";
import { basenameTask, walletAgeTask } from "./identity";
import { liveCodeTask, referralsTask, reviewTask, webhookTask } from "./community";

const ALL = [
  tokenBalanceTask,
  contractReadTask,
  tokenBoughtTask,
  heldSinceTask,
  farcasterAccountTask,
  farcasterFollowTask,
  farcasterReactionTask,
  farcasterChannelTask,
  xPostTask,
  quizTask,
  secretWordTask,
  basenameTask,
  walletAgeTask,
  referralsTask,
  liveCodeTask,
  webhookTask,
  reviewTask,
] as TaskType<unknown>[];

export const TASK_TYPES: ReadonlyMap<string, TaskType<unknown>> = new Map(ALL.map((t) => [t.type, t]));

export function getTaskType(type: string): TaskType<unknown> | null {
  return TASK_TYPES.get(type) ?? null;
}

/** Catalog for the creator UI. */
export function taskCatalog() {
  return ALL.map((t) => ({ type: t.type, label: t.label, trust: t.trust, needsSubmission: t.needsSubmission }));
}
