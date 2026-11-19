/**
 * Drop task service (server only): definitions, per-wallet progress, task checks, tickets.
 * API routes are thin wrappers around these functions.
 */
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { IS_DROPS_TESTNET, createDropsPublicClient } from "./network";
import { dropsKv } from "./kv";
import { activeDefinition, currentResults, dropDay, dropStart, evaluate, taskActiveOnDay, type Evaluation } from "./engine";
import { PoolError, allocateShare, buildPool, settleShares, type PoolKeys, type SplitPool } from "./split-pool";
import { addressLeaf, verifyProof } from "./merkle";
import { CODE_TAG, LINK_TAG, ethSignedInner } from "./client";
import { getTaskType } from "./tasks";
import { walletPostCode } from "./tasks/social-proof";
import { decisionKey, liveCode, liveCodeExpiresIn, reviewKey, type ReviewItem } from "./tasks/community";
import { recoverMessageAddress, toHex, type Hex } from "viem";
import { isSealed, openJson, sealJson } from "@/lib/voucher/secret-box";
import { computeReward, drawWinners, maxPossibleReward, nextStreak, raffleCommit, streakMultiplierBps } from "./rewards";
import {
  BASE_CHAIN_ID,
  FIRST_DROP_ID,
  TICKET_TTL_SEC,
  dropsContract,
  readDrop,
  readNextDropId,
  readWallet,
  signTicket,
  ticketSigner,
  type OnchainDrop,
} from "./chain";
import {
  dropDefinitionSchema,
  type DropDefinition,
  type StoredTaskResult,
  type TaskChainClient,
  type TaskContext,
  type TaskKv,
  type WalletProgress,
} from "./types";

export class DropError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export interface DropDeps {
  contract: `0x${string}`;
  client: TaskChainClient &
    Parameters<typeof readDrop>[0] & {
      /** Used once per raffle draw for unpredictable randomness. */
      getBlock?: (args?: { blockTag?: "latest" }) => Promise<{ hash: Hex | null; number: bigint | null }>;
    };
  kv: TaskKv;
  fetch: typeof fetch;
  env: { neynarKey?: string; explorerKey?: string };
  now: () => number;
}

/** Real dependencies; throws 503 until the contract is configured. */
export function defaultDeps(): DropDeps {
  const contract = dropsContract();
  if (!contract) throw new DropError("Drops aren't live on this deployment yet.", 503);
  return {
    contract,
    client: (IS_DROPS_TESTNET ? createDropsPublicClient() : createBasePublicClient()) as unknown as DropDeps["client"],
    kv: dropsKv,
    fetch: (...args) => fetch(...args),
    env: {
      neynarKey: process.env.NEYNAR_API_KEY?.trim() || undefined,
      explorerKey:
        (process.env.BASESCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY || process.env.BASESCAN_API_KEYS?.split(",")[0])?.trim() ||
        undefined,
    },
    now: () => Math.floor(Date.now() / 1000),
  };
}

export function parseDropId(raw: string): bigint {
  if (!/^\d{10,20}$/.test(raw)) throw new DropError("Invalid drop id", 400);
  const id = BigInt(raw);
  if (id < FIRST_DROP_ID) throw new DropError("Invalid drop id", 400);
  return id;
}

const defKey = (d: DropDeps, id: bigint) => `drops:def:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;
const progressKey = (d: DropDeps, id: bigint, wallet: string) =>
  `drops:prog:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}:${wallet.toLowerCase()}`;

async function loadDrop(d: DropDeps, id: bigint): Promise<OnchainDrop> {
  let drop: OnchainDrop | null;
  try {
    drop = await readDrop(d.client, d.contract, id);
  } catch {
    throw new DropError("Couldn't read the drop right now. Try again.", 503);
  }
  if (!drop) throw new DropError("Drop not found", 404);
  return drop;
}

/**
 * Private settings (webhook secrets, event-code secrets, quiz answer hashes, raffle seeds) are
 * sealed at rest with VOUCHER_SECRETS_KEY when it is set (see lib/voucher/secret-box.ts).
 * Records written before the key existed still read as plain JSON.
 */
function sealValue(value: unknown, scope: string): string {
  return sealJson(value, scope) ?? JSON.stringify(value);
}

function openValue<T>(raw: string, scope: string): T {
  if (isSealed(raw)) return openJson<T>(raw, scope);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T; // pre-encryption raffle seeds were stored as bare hex
  }
}

const defScope = (d: DropDeps, id: bigint) => `drops-def:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;

export async function loadDefinition(d: DropDeps, id: bigint): Promise<DropDefinition | null> {
  const raw = await d.kv.get(defKey(d, id));
  return raw ? openValue<DropDefinition>(raw, defScope(d, id)) : null;
}

const isZeroAddr = (a: string) => /^0x0{40}$/i.test(a);
const isZeroBytes32 = (a: string) => /^0x0{64}$/i.test(a);

// ───────────────────────────── random split pool ─────────────────────────────

const poolKeys = (d: DropDeps, id: bigint): PoolKeys => {
  const base = `${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;
  return {
    pool: `drops:pool:${base}`,
    slot: (k) => `drops:pool-slot:${base}:${k}`,
    ptr: (wallet, claimIndex) => `drops:pool-ptr:${base}:${wallet.toLowerCase()}:${claimIndex}`,
  };
};

async function readPool(d: DropDeps, id: bigint): Promise<SplitPool | null> {
  const raw = await d.kv.get(poolKeys(d, id).pool);
  return raw ? openValue<SplitPool>(raw, defScope(d, id)) : null;
}

/** Create the private list of shares when a split drop's rules are saved (kept if nothing changed). */
async function ensurePool(d: DropDeps, id: bigint, drop: OnchainDrop, rewards: { min?: string; max?: string }) {
  const min = BigInt(rewards.min ?? "0");
  const max = BigInt(rewards.max ?? "0");
  const existing = await readPool(d, id);
  if (existing) {
    const same = existing.min === min.toString() && existing.max === max.toString() && existing.count === drop.maxClaimsTotal;
    if (same || drop.claimedCount > 0) return;
    // Nobody has claimed yet: the creator may change the split; old reservations just expire.
  } else if (drop.claimedCount > 0) {
    throw new DropError("This drop already has claims, so a random split can't be set up now.", 409);
  }
  try {
    const pool = buildPool({ budget: drop.budget, count: drop.maxClaimsTotal, min, max, cap: drop.maxAmountPerClaim });
    await d.kv.set(poolKeys(d, id).pool, sealValue(pool, defScope(d, id)));
  } catch (e) {
    if (e instanceof PoolError) throw new DropError(e.message, e.status);
    throw e;
  }
}

/** Called after a claim confirms: makes the wallet's share permanent right away. */
export async function confirmClaim(d: DropDeps, id: bigint, wallet: `0x${string}`): Promise<{ settled: boolean }> {
  const def = await loadDefinition(d, id);
  if (def?.rewards?.mode !== "split") return { settled: false };
  const w = await readWallet(d.client, d.contract, id, wallet);
  await settleShares(d.kv, poolKeys(d, id), wallet, w.claimIndex);
  return { settled: true };
}

/** The link / gift-card proofs a split drop needs before it reserves a share for a wallet. */
export interface AccessProof {
  linkSig?: Hex;
  code?: `0x${string}`;
  codeProof?: Hex[];
  codeSig?: Hex;
}

async function checkAccessProof(d: DropDeps, id: bigint, drop: OnchainDrop, wallet: `0x${string}`, proof?: AccessProof) {
  if (!isZeroAddr(drop.linkSigner)) {
    if (!proof?.linkSig) throw new DropError("Open the full link from the sender to get your share.", 403);
    const who = await recoverMessageAddress({ message: { raw: ethSignedInner(LINK_TAG, d.contract, id, wallet) }, signature: proof.linkSig }).catch(() => null);
    if (!who || who.toLowerCase() !== drop.linkSigner.toLowerCase()) throw new DropError("This link isn't valid for this drop.", 403);
  }
  if (!isZeroBytes32(drop.codesRoot)) {
    if (!proof?.code || !proof.codeSig || !Array.isArray(proof.codeProof)) throw new DropError("Open the full gift-card link to get your share.", 403);
    const who = await recoverMessageAddress({ message: { raw: ethSignedInner(CODE_TAG, d.contract, id, wallet) }, signature: proof.codeSig }).catch(() => null);
    if (!who || who.toLowerCase() !== proof.code.toLowerCase()) throw new DropError("This code isn't valid for this drop.", 403);
    if (!verifyProof(proof.codeProof, drop.codesRoot, addressLeaf(proof.code))) throw new DropError("This code isn't valid for this drop.", 403);
  }
}

// ───────────────────────────── creator: save tasks ─────────────────────────────

/**
 * Save (or replace) a drop's tasks. Only the onchain creator, only for drops whose ticket
 * signer is this app, and a committed drop's tasks can't change once saved.
 */
export async function saveDefinition(d: DropDeps, id: bigint, sessionAddress: string, input: unknown): Promise<DropDefinition> {
  const drop = await loadDrop(d, id);
  if (drop.creator.toLowerCase() !== sessionAddress.toLowerCase()) throw new DropError("Only the drop's creator can set its tasks", 403);
  const signer = ticketSigner();
  if (!signer || drop.ticketSigner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new DropError("This drop doesn't use app-verified tasks (its ticket signer isn't this app).", 400);
  }
  if (drop.closed) throw new DropError("Drop closed", 400);
  if (drop.committed && (await loadDefinition(d, id))) throw new DropError("A committed drop's tasks can't change.", 409);

  const parsed = dropDefinitionSchema.safeParse(input);
  if (!parsed.success) throw new DropError(parsed.error.issues[0]?.message ?? "Invalid tasks", 400);
  const def = parsed.data;

  const dropKey = defKey(d, id);
  const tasks = def.tasks.map((t) => {
    const type = getTaskType(t.type);
    if (!type) throw new DropError(`Unknown task type "${t.type}"`, 400);
    let config: unknown;
    try {
      config = type.prepare ? type.prepare(t.config, { dropKey, taskId: t.id }) : t.config;
    } catch {
      throw new DropError(`Task "${t.id}": invalid settings`, 400);
    }
    const ok = type.configSchema.safeParse(config);
    if (!ok.success) throw new DropError(`Task "${t.id}": ${ok.error.issues[0]?.message ?? "invalid settings"}`, 400);
    return { ...t, config: ok.data };
  });
  for (const tier of def.tiers ?? []) {
    if (BigInt(tier.amount) > drop.maxAmountPerClaim) {
      throw new DropError("A reward tier is above the drop's max amount per claim.", 400);
    }
  }
  // The biggest possible ticket must fit the onchain cap, or claims would fail at the contract.
  const topBase = (def.tiers ?? []).reduce((m, t) => (BigInt(t.amount) > m ? BigInt(t.amount) : m), drop.amountPerClaim);
  if (maxPossibleReward(topBase, def.rewards) > drop.maxAmountPerClaim) {
    throw new DropError("With these rewards a claim could exceed the drop's max per claim. Lower them or create the drop with a higher max.", 400);
  }

  if (def.rewards?.mode === "split") await ensurePool(d, id, drop, def.rewards);
  let raffle = def.raffle;
  if (raffle) {
    if (raffle.drawAt <= d.now()) throw new DropError("The raffle draw time must be in the future.", 400);
    if (raffle.drawAt >= drop.expiresAt) throw new DropError("The raffle must be drawn before the drop ends.", 400);
    // Keep the existing seed if the raffle is re-saved unchanged; otherwise commit to a new one.
    const prev = (await loadDefinition(d, id))?.raffle;
    const seedKey = raffleSeedKey(d, id);
    const sealedSeed = await d.kv.get(seedKey);
    let seed = sealedSeed ? openValue<string>(sealedSeed, defScope(d, id)) : null;
    if (!seed || !prev || prev.drawAt !== raffle.drawAt || prev.winners !== raffle.winners) {
      if (await d.kv.get(raffleResultKey(d, id))) throw new DropError("This raffle was already drawn.", 409);
      seed = toHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
      await d.kv.set(seedKey, sealValue(seed, defScope(d, id)));
      await d.kv.set(raffleEntrantsKey(d, id), "[]");
    }
    raffle = { ...raffle, commit: raffleCommit(seed as Hex) };
  }

  const stored: DropDefinition = { ...def, tasks, raffle };
  await d.kv.set(dropKey, sealValue(stored, defScope(d, id)));
  return stored;
}

/** Validate + prepare one task spec (hash answers, schema-check config). */
function prepareTask(d: DropDeps, id: bigint, t: DropDefinition["tasks"][number]): DropDefinition["tasks"][number] {
  const type = getTaskType(t.type);
  if (!type) throw new DropError(`Unknown task type "${t.type}"`, 400);
  let config: unknown;
  try {
    config = type.prepare ? type.prepare(t.config, { dropKey: defKey(d, id), taskId: t.id }) : t.config;
  } catch {
    throw new DropError(`Task "${t.id}": invalid settings`, 400);
  }
  const ok = type.configSchema.safeParse(config);
  if (!ok.success) throw new DropError(`Task "${t.id}": ${ok.error.issues[0]?.message ?? "invalid settings"}`, 400);
  return { ...t, config: ok.data };
}

/**
 * Change tasks day by day without redoing the drop: add new tasks (e.g. tomorrow's post task)
 * and/or remove old ones. Creator only, never on a locked (committed) drop. Rewards, raffle and
 * everything else stay as they are. New task ids are assigned here.
 */
export async function updateTasks(
  d: DropDeps,
  id: bigint,
  sessionAddress: string,
  input: { add?: unknown; remove?: unknown }
): Promise<DropDefinition> {
  const drop = await loadDrop(d, id);
  if (drop.creator.toLowerCase() !== sessionAddress.toLowerCase()) throw new DropError("Only the drop's creator can change its tasks", 403);
  if (drop.closed) throw new DropError("Drop closed", 400);
  if (drop.committed) throw new DropError("This drop is locked until it ends, so its tasks can't change.", 409);
  const def = await loadDefinition(d, id);
  if (!def) throw new DropError("Save this drop's tasks first.", 404);

  const remove = new Set(Array.isArray(input.remove) ? input.remove.map(String) : []);
  const kept = def.tasks.filter((t) => !remove.has(t.id));
  const adds = Array.isArray(input.add) ? input.add : [];
  if (adds.length > 40) throw new DropError("Too many tasks at once.", 400);

  let n = def.tasks.reduce((m, t) => Math.max(m, Number(/^t(\d+)$/.exec(t.id)?.[1] ?? 0)), 0);
  const added = adds.map((raw) => {
    n += 1;
    const parsed = dropDefinitionSchema.safeParse({ version: 1, tasks: [{ ...(raw as object), id: `t${n}` }] });
    if (!parsed.success) throw new DropError(parsed.error.issues[0]?.message ?? "Invalid task", 400);
    return prepareTask(d, id, parsed.data.tasks[0]!);
  });

  const next: DropDefinition = { ...def, tasks: [...kept, ...added] };
  const check = dropDefinitionSchema.safeParse(next);
  if (!check.success) throw new DropError(check.error.issues[0]?.message ?? "Invalid tasks", 400);
  await d.kv.set(defKey(d, id), sealValue(next, defScope(d, id)));
  return next;
}

/** Tasks as claimers see them: no answers or salts. */
export function publicDefinition(def: DropDefinition, sched?: { start: number; now: number }) {
  const day = sched ? dropDay(sched.start, sched.now) : undefined;
  return {
    day,
    start: sched?.start,
    version: def.version,
    minPoints: def.minPoints,
    tiers: def.tiers,
    rewards: def.rewards,
    raffle: def.raffle,
    tasks: def.tasks.map((t) => {
      const type = getTaskType(t.type);
      return {
        id: t.id,
        type: t.type,
        title: t.title ?? type?.label ?? t.type,
        required: t.required,
        points: t.points,
        group: t.group,
        repeat: t.repeat,
        days: t.days,
        activeNow: day === undefined ? true : taskActiveOnDay(t, Math.max(1, day)),
        trust: type?.trust,
        needsSubmission: type?.needsSubmission ?? false,
        config: type?.publicConfig ? type.publicConfig(t.config) : t.config,
      };
    }),
  };
}

// ───────────────────────────── claimer: progress, checks, ticket ─────────────────────────────

async function readProgress(d: DropDeps, id: bigint, wallet: string): Promise<WalletProgress> {
  const raw = await d.kv.get(progressKey(d, id, wallet));
  return raw ? (JSON.parse(raw) as WalletProgress) : { results: {} };
}

async function writeProgress(d: DropDeps, id: bigint, wallet: string, p: WalletProgress, ttlSec: number) {
  await d.kv.set(progressKey(d, id, wallet), JSON.stringify(p), Math.max(3600, ttlSec));
}

function contextFor(d: DropDeps, id: bigint, drop: OnchainDrop, wallet: `0x${string}`, taskId: string, submission?: unknown): TaskContext {
  return {
    chainId: BASE_CHAIN_ID,
    dropsContract: d.contract,
    dropId: id,
    dropCreatedAt: drop.createdAt,
    taskId,
    claimer: wallet,
    now: d.now(),
    submission,
    client: d.client,
    fetch: d.fetch,
    env: d.env,
    kv: d.kv,
  };
}

export interface ProgressView {
  claimIndex: number;
  blocker: string;
  evaluation: Evaluation;
  results: Record<string, Pick<StoredTaskResult, "status" | "message" | "at">>;
  /** Per-task extras for the claim page (e.g. the X post code for this wallet). */
  extras: Record<string, Record<string, string>>;
  /** Streak the next claim would count as, and its bonus (10000 = ×1). */
  streak?: { next: number; multiplierBps: number };
  /** 1-based day of the drop, and whether tasks exist but none are active today. */
  day?: number;
  noTaskToday?: boolean;
}

export async function getProgress(d: DropDeps, id: bigint, wallet: `0x${string}`): Promise<ProgressView> {
  const full = await loadDefinition(d, id);
  if (!full) throw new DropError("This drop has no tasks", 404);
  const drop = await loadDrop(d, id);
  const def = activeDefinition(full, dropStart(drop), d.now());
  const [w, progress] = await Promise.all([readWallet(d.client, d.contract, id, wallet), readProgress(d, id, wallet)]);
  if (full.rewards?.mode === "split" && w.claimIndex > 0) await settleShares(d.kv, poolKeys(d, id), wallet, w.claimIndex);
  const results = currentResults(def, progress, w.claimIndex, d.now());
  const extras: ProgressView["extras"] = {};
  for (const t of def.tasks) {
    if (t.type === "x_post") extras[t.id] = { code: walletPostCode(id, wallet, t.id) };
  }
  let streak: ProgressView["streak"];
  if (def.rewards?.streak) {
    const next = nextStreak({
      claimIndex: w.claimIndex,
      lastClaimAt: w.lastClaimAt,
      now: d.now(),
      windowHours: def.rewards.streak.windowHours,
      prev: await readStreak(d, id, wallet),
    });
    streak = { next, multiplierBps: streakMultiplierBps(def.rewards, next) };
  }
  return {
    claimIndex: w.claimIndex,
    blocker: w.blocker,
    evaluation: evaluate(def, results),
    results: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { status: r.status, message: r.message, at: r.at }])),
    extras,
    streak,
    day: dropDay(dropStart(drop), d.now()),
    noTaskToday: def.noTaskToday,
  };
}

const streakKey = (d: DropDeps, id: bigint, wallet: string) =>
  `drops:streak:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}:${wallet.toLowerCase()}`;

async function readStreak(d: DropDeps, id: bigint, wallet: string): Promise<{ forClaimIndex: number; streak: number } | null> {
  const raw = await d.kv.get(streakKey(d, id, wallet));
  return raw ? (JSON.parse(raw) as { forClaimIndex: number; streak: number }) : null;
}

/** Re-run tasks whose result can change, then evaluate. Shared by tickets and raffle entry. */
async function recheckAndEvaluate(
  d: DropDeps,
  id: bigint,
  drop: OnchainDrop,
  def: DropDefinition & { noTaskToday?: boolean },
  wallet: `0x${string}`,
  claimIndex: number
) {
  const progress = await readProgress(d, id, wallet);
  const results = currentResults(def, progress, claimIndex, d.now());
  for (const t of def.tasks) {
    const type = getTaskType(t.type);
    if (!type?.recheckAtClaim || results[t.id]?.status !== "passed") continue;
    const r = await type.verify(t.config, contextFor(d, id, drop, wallet, t.id));
    results[t.id] = { ...r, at: d.now(), claimIndex };
    progress.results[t.id] = results[t.id]!;
  }
  await writeProgress(d, id, wallet, progress, Math.max(0, drop.expiresAt - d.now()));
  return evaluate(def, results);
}

/** Run one task for the wallet and remember the result. */
export async function checkTask(
  d: DropDeps,
  id: bigint,
  wallet: `0x${string}`,
  taskId: string,
  submission?: unknown
): Promise<StoredTaskResult> {
  const def = await loadDefinition(d, id);
  if (!def) throw new DropError("This drop has no tasks", 404);
  const spec = def.tasks.find((t) => t.id === taskId);
  if (!spec) throw new DropError("Unknown task", 404);
  const type = getTaskType(spec.type);
  if (!type) throw new DropError("This task type is no longer supported", 400);

  const drop = await loadDrop(d, id);
  if (!taskActiveOnDay(spec, Math.max(1, dropDay(dropStart(drop), d.now())))) {
    throw new DropError("This task isn't active today. Come back on its day.", 409);
  }
  const { claimIndex } = await readWallet(d.client, d.contract, id, wallet);
  const r = await type.verify(spec.config, contextFor(d, id, drop, wallet, taskId, submission));
  const stored: StoredTaskResult = { ...r, at: d.now(), claimIndex };

  const progress = await readProgress(d, id, wallet);
  // Never overwrite a pass with "unavailable" (an outage shouldn't undo finished work).
  const prev = progress.results[taskId];
  if (!(r.status === "unavailable" && prev?.status === "passed" && prev.claimIndex === claimIndex)) {
    progress.results[taskId] = stored;
  }
  await writeProgress(d, id, wallet, progress, Math.max(0, drop.expiresAt - d.now()));
  return stored;
}

export interface Ticket {
  dropId: string;
  claimer: `0x${string}`;
  claimIndex: number;
  amount: string;
  deadline: number;
  ticket: `0x${string}`;
}

/**
 * Re-check the tasks that can change (balances, follows…), then sign a ticket for exactly this
 * wallet's next claim. Nothing ever auto-passes: an outage means no ticket.
 */
export async function issueTicket(d: DropDeps, id: bigint, wallet: `0x${string}`, proof?: AccessProof): Promise<Ticket> {
  const full = await loadDefinition(d, id);
  if (!full) throw new DropError("This drop has no tasks", 404);
  const drop = await loadDrop(d, id);
  const def = { ...full, ...activeDefinition(full, dropStart(drop), d.now()) };
  const signer = ticketSigner();
  if (!signer || drop.ticketSigner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new DropError("This drop doesn't use app-verified tasks.", 400);
  }
  const w = await readWallet(d.client, d.contract, id, wallet);
  if (w.blocker) throw new DropError(w.blocker, 409);

  if (def.raffle) {
    const result = await readRaffleResult(d, id);
    if (!result) throw new DropError("The raffle hasn't been drawn yet.", 403);
    if (!result.winners.includes(wallet.toLowerCase())) throw new DropError("This wallet wasn't drawn in the raffle.", 403);
  }

  const ev = await recheckAndEvaluate(d, id, drop, def, wallet, w.claimIndex);
  if (!ev.eligible) {
    throw new DropError(ev.missing.includes("schedule:no-task-today") ? "There's no task scheduled for today. Check back tomorrow." : "Finish the remaining tasks first.", 403);
  }

  const split = full.rewards?.mode === "split";
  if (split) {
    await checkAccessProof(d, id, drop, wallet, proof);
    await settleShares(d.kv, poolKeys(d, id), wallet, w.claimIndex);
  }

  let streak = 1;
  if (def.rewards?.streak) {
    streak = nextStreak({
      claimIndex: w.claimIndex,
      lastClaimAt: w.lastClaimAt,
      now: d.now(),
      windowHours: def.rewards.streak.windowHours,
      prev: await readStreak(d, id, wallet),
    });
    // Remembered per claim number, so asking for the ticket twice gives the same streak.
    await d.kv.set(streakKey(d, id, wallet), JSON.stringify({ forClaimIndex: w.claimIndex, streak }), Math.max(3600, drop.expiresAt - d.now()));
  }
  const base = ev.amount !== "0" ? BigInt(ev.amount) : drop.amountPerClaim;
  let amount: bigint;
  if (split) {
    const pool = await readPool(d, id);
    if (!pool) throw new DropError("This drop's random split isn't set up yet.", 503);
    try {
      amount = await allocateShare(d.kv, poolKeys(d, id), pool, wallet, w.claimIndex);
    } catch (e) {
      if (e instanceof PoolError) throw new DropError(e.message, e.status);
      throw e;
    }
  } else {
    amount = computeReward({ base, rules: def.rewards, streak, cap: drop.maxAmountPerClaim });
  }
  // Never sign more than the escrow still holds (a lapsed reservation can't overdraw it).
  if (amount > drop.budget) amount = drop.budget;
  if (amount <= BigInt(0)) throw new DropError("This drop has nothing left to claim.", 409);

  const deadline = BigInt(d.now() + TICKET_TTL_SEC);
  const sig = await signTicket({
    chainId: BASE_CHAIN_ID,
    contract: d.contract,
    dropId: id,
    claimer: wallet,
    claimIndex: w.claimIndex,
    amount,
    deadline,
  });
  if (!sig) throw new DropError("Ticket signing isn't set up on this deployment.", 503);
  return {
    dropId: id.toString(),
    claimer: wallet,
    claimIndex: w.claimIndex,
    amount: amount.toString(),
    deadline: Number(deadline),
    ticket: sig,
  };
}

// ───────────────────────────── allowlists ─────────────────────────────

const allowlistKey = (d: DropDeps, id: bigint) => `drops:allow:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;

/**
 * Store a drop's allowlist so claimers can fetch their proof. The list must hash to the
 * allowlistRoot the drop committed to onchain, so nobody can publish a different list.
 */
export async function saveAllowlist(d: DropDeps, id: bigint, sessionAddress: string, addresses: unknown): Promise<number> {
  const drop = await loadDrop(d, id);
  if (drop.creator.toLowerCase() !== sessionAddress.toLowerCase()) throw new DropError("Only the drop's creator can upload its list", 403);
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > 10_000) {
    throw new DropError("Upload 1 to 10,000 addresses", 400);
  }
  const list = [...new Set(addresses.map((a) => String(a).toLowerCase()))];
  if (list.some((a) => !/^0x[0-9a-f]{40}$/.test(a))) throw new DropError("Every entry must be a 0x address", 400);
  const { buildAddressTree } = await import("./merkle");
  if (buildAddressTree(list).root.toLowerCase() !== drop.allowlistRoot.toLowerCase()) {
    throw new DropError("This list doesn't match the drop's onchain allowlist.", 400);
  }
  await d.kv.set(allowlistKey(d, id), JSON.stringify(list));
  return list.length;
}

/** Merkle proof for `wallet`, or null when it isn't on the list (or no list was uploaded). */
export async function allowlistProof(d: DropDeps, id: bigint, wallet: string): Promise<`0x${string}`[] | null> {
  const raw = await d.kv.get(allowlistKey(d, id));
  if (!raw) return null;
  const { buildAddressTree } = await import("./merkle");
  return buildAddressTree(JSON.parse(raw) as string[]).proof(wallet);
}

// ───────────────────────────── raffles ─────────────────────────────

const raffleSeedKey = (d: DropDeps, id: bigint) => `drops:raffle-seed:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;
const raffleEntrantsKey = (d: DropDeps, id: bigint) => `drops:raffle-in:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;
const raffleResultKey = (d: DropDeps, id: bigint) => `drops:raffle-out:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;

export interface RaffleResult {
  winners: string[];
  entrants: number;
  seed: Hex;
  blockNumber: string;
  blockHash: Hex;
  drawnAt: number;
}

async function readRaffleResult(d: DropDeps, id: bigint): Promise<RaffleResult | null> {
  const raw = await d.kv.get(raffleResultKey(d, id));
  return raw ? (JSON.parse(raw) as RaffleResult) : null;
}

async function readEntrants(d: DropDeps, id: bigint): Promise<string[]> {
  const raw = await d.kv.get(raffleEntrantsKey(d, id));
  return raw ? (JSON.parse(raw) as string[]) : [];
}

/** Enter the raffle: the wallet must have finished the tasks (re-checked now), before the draw. */
export async function enterRaffle(d: DropDeps, id: bigint, wallet: `0x${string}`): Promise<{ entrants: number }> {
  const def = await loadDefinition(d, id);
  if (!def?.raffle) throw new DropError("This drop has no raffle", 404);
  if (d.now() >= def.raffle.drawAt) throw new DropError("Entries are closed: the raffle is being drawn.", 409);
  const drop = await loadDrop(d, id);
  const w = await readWallet(d.client, d.contract, id, wallet);
  const ev = await recheckAndEvaluate(d, id, drop, activeDefinition(def, dropStart(drop), d.now()), wallet, w.claimIndex);
  if (!ev.eligible) throw new DropError("Finish the tasks to enter.", 403);
  const list = await readEntrants(d, id);
  if (!list.includes(wallet.toLowerCase())) {
    if (list.length >= 50_000) throw new DropError("This raffle is full.", 409);
    list.push(wallet.toLowerCase());
    await d.kv.set(raffleEntrantsKey(d, id), JSON.stringify(list));
  }
  return { entrants: list.length };
}

/**
 * Draw winners once the draw time has passed (anyone may trigger it; the first draw is final).
 * Randomness = keccak(seed committed at setup + latest block hash), re-checkable from the result.
 */
export async function drawRaffle(d: DropDeps, id: bigint): Promise<RaffleResult> {
  const def = await loadDefinition(d, id);
  if (!def?.raffle) throw new DropError("This drop has no raffle", 404);
  const existing = await readRaffleResult(d, id);
  if (existing) return existing;
  if (d.now() < def.raffle.drawAt) throw new DropError("It is not time to draw yet.", 409);
  const sealedSeed = await d.kv.get(raffleSeedKey(d, id));
  const seed = sealedSeed ? (openValue<string>(sealedSeed, defScope(d, id)) as Hex) : null;
  if (!seed) throw new DropError("Raffle seed missing.", 500);
  if (!d.client.getBlock) throw new DropError("Cannot read the chain right now.", 503);
  const block = await d.client.getBlock({ blockTag: "latest" });
  if (!block.hash || block.number === null) throw new DropError("Cannot read the chain right now.", 503);
  const entrants = await readEntrants(d, id);
  const result: RaffleResult = {
    winners: drawWinners(entrants, def.raffle.winners, seed, block.hash),
    entrants: entrants.length,
    seed,
    blockNumber: block.number.toString(),
    blockHash: block.hash,
    drawnAt: d.now(),
  };
  // First draw wins; a concurrent second draw returns the stored one.
  await d.kv.setIfAbsent(raffleResultKey(d, id), JSON.stringify(result));
  return (await readRaffleResult(d, id))!;
}

export async function raffleStatus(d: DropDeps, id: bigint, wallet?: string) {
  const def = await loadDefinition(d, id);
  if (!def?.raffle) throw new DropError("This drop has no raffle", 404);
  const [entrants, result] = await Promise.all([readEntrants(d, id), readRaffleResult(d, id)]);
  const me = wallet?.toLowerCase();
  return {
    winners: def.raffle.winners,
    drawAt: def.raffle.drawAt,
    commit: def.raffle.commit,
    entrants: entrants.length,
    entered: me ? entrants.includes(me) : false,
    result: result ? { ...result, won: me ? result.winners.includes(me) : false } : null,
  };
}

// ───────────────────────────── creator tools ─────────────────────────────

async function requireCreator(d: DropDeps, id: bigint, sessionAddress: string) {
  const drop = await loadDrop(d, id);
  if (drop.creator.toLowerCase() !== sessionAddress.toLowerCase()) throw new DropError("Only the creator of this drop can do this", 403);
  return drop;
}

/** Submissions waiting for the creator (newest first). */
export async function listReviews(d: DropDeps, id: bigint, sessionAddress: string): Promise<Array<ReviewItem & { decided: boolean }>> {
  await requireCreator(d, id, sessionAddress);
  const raw = await d.kv.get(reviewKey({ dropsContract: d.contract, dropId: id }));
  const items = raw ? (JSON.parse(raw) as ReviewItem[]) : [];
  const out: Array<ReviewItem & { decided: boolean }> = [];
  for (const it of items.slice(0, 200)) {
    const dec = await d.kv.get(decisionKey({ dropsContract: d.contract, dropId: id }, it.taskId, it.wallet));
    out.push({ ...it, decided: Boolean(dec) });
  }
  return out;
}

/** Approve or reject a submission; the claimer's task updates right away. */
export async function decideReview(
  d: DropDeps,
  id: bigint,
  sessionAddress: string,
  input: { wallet?: unknown; taskId?: unknown; approve?: unknown; note?: unknown }
): Promise<void> {
  await requireCreator(d, id, sessionAddress);
  const wallet = String(input.wallet ?? "").toLowerCase();
  const taskId = String(input.taskId ?? "");
  if (!/^0x[0-9a-f]{40}$/.test(wallet) || !taskId) throw new DropError("Invalid review", 400);
  const def = await loadDefinition(d, id);
  const spec = def?.tasks.find((t) => t.id === taskId && t.type === "review");
  if (!spec) throw new DropError("Unknown review task", 404);
  const approve = input.approve === true;
  const note = typeof input.note === "string" ? input.note.slice(0, 160) : undefined;
  await d.kv.set(decisionKey({ dropsContract: d.contract, dropId: id }, taskId, wallet), JSON.stringify({ approve, note }));
  const progress = await readProgress(d, id, wallet);
  const { claimIndex } = await readWallet(d.client, d.contract, id, wallet as `0x${string}`);
  progress.results[taskId] = {
    status: approve ? "passed" : "failed",
    message: approve ? (note ? `Approved: ${note}` : "Approved by the creator.") : note ? `Not approved: ${note}` : "Not approved. You can submit again.",
    at: d.now(),
    claimIndex,
  };
  await writeProgress(d, id, wallet, progress, 30 * 86_400);
}

/** The current 6-digit event code for a live_code task (creator only, to show on screen). */
export async function currentLiveCode(d: DropDeps, id: bigint, sessionAddress: string, taskId: string) {
  await requireCreator(d, id, sessionAddress);
  const def = await loadDefinition(d, id);
  const spec = def?.tasks.find((t) => t.id === taskId && t.type === "live_code");
  if (!spec) throw new DropError("Unknown event-code task", 404);
  const secret = (spec.config as { secret: string }).secret;
  const now = d.now();
  return { code: liveCode(secret, now), expiresIn: liveCodeExpiresIn(now) };
}

/** The drop's tasks as claimers see them today (with each task's day window and whether it is active now). */
export async function getPublicDefinition(d: DropDeps, id: bigint) {
  const def = await loadDefinition(d, id);
  if (!def) return null;
  let drop: OnchainDrop | null = null;
  try {
    drop = await readDrop(d.client, d.contract, id);
  } catch {
    drop = null;
  }
  return publicDefinition(def, drop ? { start: dropStart(drop), now: d.now() } : undefined);
}

// ───────────────────────────── public listing + feed ─────────────────────────────

export const LISTING_CATEGORIES = ["quest", "daily", "holders", "gift", "airdrop"] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export interface Listing {
  title: string;
  blurb: string;
  category: ListingCategory;
  listedAt: number;
}

const listingKey = (d: DropDeps, id: bigint) => `drops:listing:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${id}`;

/**
 * List a drop in the public feed (or remove it with null). Creator only. Only drops anyone can
 * reach on their own (tasks, token holders) can be listed: a link or gift-card drop's secret
 * would otherwise have to be published.
 */
export async function saveListing(d: DropDeps, id: bigint, sessionAddress: string, input: unknown): Promise<Listing | null> {
  const drop = await loadDrop(d, id);
  if (drop.creator.toLowerCase() !== sessionAddress.toLowerCase()) throw new DropError("Only the drop's creator can list it", 403);
  if (input === null) {
    await d.kv.set(listingKey(d, id), "null");
    return null;
  }
  if (!isZeroAddr(drop.linkSigner) || !isZeroBytes32(drop.codesRoot)) {
    throw new DropError("Link and gift-card drops are private by design, so they can't be listed publicly.", 400);
  }
  if (drop.closed) throw new DropError("Drop closed", 400);
  const o = (input ?? {}) as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 60) : "";
  const blurb = typeof o.blurb === "string" ? o.blurb.trim().slice(0, 160) : "";
  const category = LISTING_CATEGORIES.find((c) => c === o.category);
  if (title.length < 3) throw new DropError("Give your drop a title (3+ characters).", 400);
  if (!category) throw new DropError("Pick a category.", 400);
  const listing: Listing = { title, blurb, category, listedAt: d.now() };
  await d.kv.set(listingKey(d, id), JSON.stringify(listing));
  return listing;
}

export async function readListing(d: DropDeps, id: bigint): Promise<Listing | null> {
  const raw = await d.kv.get(listingKey(d, id));
  if (!raw || raw === "null") return null;
  try {
    return JSON.parse(raw) as Listing;
  } catch {
    return null;
  }
}

export interface FeedItem {
  id: string;
  listing: Listing;
  creator: string;
  token: string;
  amountPerClaim: string;
  maxAmountPerClaim: string;
  budget: string;
  maxClaimsTotal: number;
  claimedCount: number;
  unlockAt: number;
  expiresAt: number;
  daily: boolean;
  split: boolean;
  gated: "tasks" | "holders" | "list";
  taskCount: number;
  taskTypes: string[];
  state: "live" | "soon" | "ended" | "closed" | "paused" | "empty";
}

const FEED_SCAN = 400;

function stateOf(drop: OnchainDrop, now: number): FeedItem["state"] {
  if (drop.closed) return "closed";
  if (now >= drop.expiresAt) return "ended";
  if ((drop.maxClaimsTotal > 0 && drop.claimedCount >= drop.maxClaimsTotal) || drop.budget < drop.amountPerClaim) return "empty";
  if (drop.paused) return "paused";
  if (drop.unlockAt > now) return "soon";
  return "live";
}

/**
 * Public drops, newest first. Drop ids are sequential, so we walk the latest ids and keep the
 * ones their creator listed: no index to keep in sync. Cached briefly because it reads the chain.
 */
export async function feed(d: DropDeps, opts: { before?: bigint; limit?: number } = {}): Promise<{ items: FeedItem[]; next: string | null }> {
  const limit = Math.max(1, Math.min(opts.limit ?? 24, 50));
  const cacheKey = `drops:feed-cache:${BASE_CHAIN_ID}:${d.contract.toLowerCase()}:${opts.before ?? "top"}:${limit}`;
  const cached = await d.kv.get(cacheKey);
  if (cached) return JSON.parse(cached) as { items: FeedItem[]; next: string | null };

  const top = await readNextDropId(d.client, d.contract);
  let cursor = opts.before !== undefined && opts.before < top ? opts.before : top;
  const items: FeedItem[] = [];
  let scanned = 0;
  while (cursor > FIRST_DROP_ID && items.length < limit && scanned < FEED_SCAN) {
    cursor -= BigInt(1);
    scanned += 1;
    const listing = await readListing(d, cursor);
    if (!listing) continue;
    const drop = await readDrop(d.client, d.contract, cursor).catch(() => null);
    if (!drop || drop.closed) continue;
    const def = await loadDefinition(d, cursor);
    items.push({
      id: cursor.toString(),
      listing,
      creator: drop.creator,
      token: drop.token,
      amountPerClaim: drop.amountPerClaim.toString(),
      maxAmountPerClaim: drop.maxAmountPerClaim.toString(),
      budget: drop.budget.toString(),
      maxClaimsTotal: drop.maxClaimsTotal,
      claimedCount: drop.claimedCount,
      unlockAt: drop.unlockAt,
      expiresAt: drop.expiresAt,
      daily: drop.cooldown > 0,
      split: def?.rewards?.mode === "split",
      gated: def ? "tasks" : !isZeroBytes32(drop.allowlistRoot) ? "list" : "holders",
      taskCount: def?.tasks.length ?? 0,
      taskTypes: [...new Set(def?.tasks.map((t) => t.type) ?? [])],
      state: stateOf(drop, d.now()),
    });
  }
  const out = { items, next: cursor > FIRST_DROP_ID && (scanned >= FEED_SCAN || items.length >= limit) ? cursor.toString() : null };
  await d.kv.set(cacheKey, JSON.stringify(out), 20);
  return out;
}
