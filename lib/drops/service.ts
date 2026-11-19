/**
 * Drop task service (server only): definitions, per-wallet progress, task checks, tickets.
 * API routes are thin wrappers around these functions.
 */
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { dropsKv } from "./kv";
import { currentResults, evaluate, type Evaluation } from "./engine";
import { getTaskType } from "./tasks";
import { walletPostCode } from "./tasks/social-proof";
import {
  BASE_CHAIN_ID,
  FIRST_DROP_ID,
  TICKET_TTL_SEC,
  dropsContract,
  readDrop,
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
  client: TaskChainClient & Parameters<typeof readDrop>[0];
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
    client: createBasePublicClient() as unknown as DropDeps["client"],
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

export async function loadDefinition(d: DropDeps, id: bigint): Promise<DropDefinition | null> {
  const raw = await d.kv.get(defKey(d, id));
  return raw ? (JSON.parse(raw) as DropDefinition) : null;
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
  const stored: DropDefinition = { ...def, tasks };
  await d.kv.set(dropKey, JSON.stringify(stored));
  return stored;
}

/** Tasks as claimers see them: no answers or salts. */
export function publicDefinition(def: DropDefinition) {
  return {
    version: def.version,
    minPoints: def.minPoints,
    tiers: def.tiers,
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
}

export async function getProgress(d: DropDeps, id: bigint, wallet: `0x${string}`): Promise<ProgressView> {
  const def = await loadDefinition(d, id);
  if (!def) throw new DropError("This drop has no tasks", 404);
  const [w, progress] = await Promise.all([readWallet(d.client, d.contract, id, wallet), readProgress(d, id, wallet)]);
  const results = currentResults(def, progress, w.claimIndex, d.now());
  const extras: ProgressView["extras"] = {};
  for (const t of def.tasks) {
    if (t.type === "x_post") extras[t.id] = { code: walletPostCode(id, wallet, t.id) };
  }
  return {
    claimIndex: w.claimIndex,
    blocker: w.blocker,
    evaluation: evaluate(def, results),
    results: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { status: r.status, message: r.message, at: r.at }])),
    extras,
  };
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
export async function issueTicket(d: DropDeps, id: bigint, wallet: `0x${string}`): Promise<Ticket> {
  const def = await loadDefinition(d, id);
  if (!def) throw new DropError("This drop has no tasks", 404);
  const drop = await loadDrop(d, id);
  const signer = ticketSigner();
  if (!signer || drop.ticketSigner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new DropError("This drop doesn't use app-verified tasks.", 400);
  }
  const w = await readWallet(d.client, d.contract, id, wallet);
  if (w.blocker) throw new DropError(w.blocker, 409);

  const progress = await readProgress(d, id, wallet);
  const results = currentResults(def, progress, w.claimIndex, d.now());
  for (const t of def.tasks) {
    const type = getTaskType(t.type);
    if (!type?.recheckAtClaim || results[t.id]?.status !== "passed") continue;
    const r = await type.verify(t.config, contextFor(d, id, drop, wallet, t.id));
    results[t.id] = { ...r, at: d.now(), claimIndex: w.claimIndex };
    progress.results[t.id] = results[t.id]!;
  }
  await writeProgress(d, id, wallet, progress, Math.max(0, drop.expiresAt - d.now()));

  const ev = evaluate(def, results);
  if (!ev.eligible) throw new DropError("Finish the remaining tasks first.", 403);
  const amount = BigInt(ev.amount);
  if (amount > drop.maxAmountPerClaim) throw new DropError("Reward is above this drop's max per claim.", 500);

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
