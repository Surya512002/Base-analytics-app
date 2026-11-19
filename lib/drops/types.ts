/**
 * Shared types for drop tasks (Phase 4 of docs/DROPS_DESIGN.md).
 *
 * A drop's onchain rules live in BaseDrops. Its offchain tasks live in a DropDefinition the
 * creator saves here. When every task passes, the app signs a ticket the contract accepts.
 */
import { z } from "zod";

/** How much a task's "passed" can be trusted. Shown to creators and claimers. */
export type TrustLevel =
  | "onchain" // read from chain by our server at check time
  | "verified" // our server checked public data from an API
  | "account" // checked as the claimer through a linked account
  | "proof" // claimer posted public proof containing their wallet's code
  | "answer"; // claimer answered a question / entered a secret

/** "pending" = waiting for the creator to review a submission (never counts as passed). */
export type TaskStatus = "passed" | "failed" | "unavailable" | "pending";

export interface TaskResult {
  status: TaskStatus;
  /** Plain-language reason, shown to the claimer. */
  message: string;
  evidence?: Record<string, string | number | boolean>;
}

/** Key-value store tasks may use (attempt counters, one-account-one-wallet bindings). */
export interface TaskKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  /** Set only if missing. Returns true when this call set it. */
  setIfAbsent(key: string, value: string, ttlSec?: number): Promise<boolean>;
  incr(key: string, ttlSec?: number): Promise<number>;
}

/** Minimal chain reads tasks need (viem PublicClient satisfies it). */
export interface TaskChainClient {
  readContract(args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  getCode(args: { address: `0x${string}` }): Promise<`0x${string}` | undefined>;
}

export interface TaskContext {
  chainId: number;
  dropsContract: `0x${string}`;
  dropId: bigint;
  /** Unix seconds the drop was created (default window start for "since" tasks). */
  dropCreatedAt: number;
  taskId: string;
  claimer: `0x${string}`;
  now: number;
  submission?: unknown;
  client: TaskChainClient;
  fetch: typeof fetch;
  env: { neynarKey?: string; explorerKey?: string };
  kv: TaskKv;
}

export interface TaskType<Config = unknown> {
  type: string;
  label: string;
  trust: TrustLevel;
  /** The claimer must send something (a URL, answers…). */
  needsSubmission: boolean;
  /** Re-checked right before a ticket is signed (balances, memberships). */
  recheckAtClaim: boolean;
  /** Validates the stored config (input may differ from output, e.g. defaults). */
  configSchema: z.ZodType<Config, z.ZodTypeDef, unknown>;
  /** Turns what the creator typed into what's stored (e.g. hashes quiz answers). */
  prepare?: (input: unknown, ctx: { dropKey: string; taskId: string }) => Config;
  /** Config safe to show claimers (no answers). */
  publicConfig?: (config: Config) => Record<string, unknown>;
  verify(config: Config, ctx: TaskContext): Promise<TaskResult>;
}

// ───────────────────────────── definitions ─────────────────────────────

const taskId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/, "Task ids are 1-32 lower-case letters, digits, - or _");
const weiString = z.string().regex(/^\d{1,78}$/, "Amounts are whole base units");

export const taskSpecSchema = z.object({
  id: taskId,
  type: z.string().min(1).max(40),
  title: z.string().max(80).optional(),
  /** Required tasks must pass. Optional ones only add points. */
  required: z.boolean().default(true),
  points: z.number().int().min(0).max(1000).default(0),
  /** Required tasks sharing a group pass when ANY of them passes ("follow on X or Farcaster"). */
  group: z.string().max(32).optional(),
  /** Must be done again before every claim (daily tasks). */
  repeat: z.boolean().default(false),
  config: z.unknown(),
});
export type TaskSpec = z.infer<typeof taskSpecSchema>;

export const dropDefinitionSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(taskSpecSchema).min(1).max(20),
    /** Points needed (on top of required tasks). */
    minPoints: z.number().int().min(0).max(20_000).optional(),
    /** Reward tiers by points; the highest reached wins. "0" = the drop's default amount. */
    tiers: z.array(z.object({ minPoints: z.number().int().min(0), amount: weiString })).max(10).optional(),
    /** Fixed (default) or a random amount per claim, plus an optional streak bonus for consecutive claims. */
    rewards: z
      .object({
        mode: z.enum(["fixed", "random"]).default("fixed"),
        min: weiString.optional(),
        max: weiString.optional(),
        streak: z
          .object({
            bonusBps: z.number().int().min(1).max(10_000),
            maxDays: z.number().int().min(2).max(365),
            windowHours: z.number().int().min(24).max(96).default(48),
          })
          .optional(),
      })
      .optional(),
    /** Raffle: wallets that finish the tasks enter; after drawAt, N winners are drawn and only they can claim. */
    raffle: z
      .object({
        winners: z.number().int().min(1).max(10_000),
        drawAt: z.number().int().positive(),
        /** keccak256(seed), set by the server when the raffle is saved. */
        commit: z.string().regex(/^0x[0-9a-f]{64}$/).optional(),
      })
      .optional(),
  })
  .superRefine((def, ctx) => {
    if (def.rewards?.mode === "random") {
      if (def.rewards.min === undefined || def.rewards.max === undefined) ctx.addIssue({ code: "custom", message: "Random rewards need a min and a max" });
      else if (BigInt(def.rewards.min) > BigInt(def.rewards.max)) ctx.addIssue({ code: "custom", message: "Random min is above max" });
      else if (BigInt(def.rewards.max) === BigInt(0)) ctx.addIssue({ code: "custom", message: "Random max must be above 0" });
    }
    const ids = new Set<string>();
    for (const t of def.tasks) {
      if (ids.has(t.id)) ctx.addIssue({ code: "custom", message: `Duplicate task id "${t.id}"` });
      ids.add(t.id);
    }
  });
export type DropDefinition = z.infer<typeof dropDefinitionSchema>;

export interface StoredTaskResult extends TaskResult {
  at: number;
  /** Wallet's claim count when this was checked (repeat tasks reset after each claim). */
  claimIndex: number;
}

export interface WalletProgress {
  results: Record<string, StoredTaskResult>;
}
