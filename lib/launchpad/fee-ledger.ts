import type { Redis } from "ioredis";
import { getReadyRedis } from "@/lib/redis-cache";

export type FeeAsset = "eth" | "usdc" | "token";

export interface FeeEvent {
  id: string;
  txHash: string;
  tokenAddress: string;
  tokenSymbol: string;
  trader: string;
  creator: string;
  referrer: string | null;
  direction: "buy" | "sell";
  feeAsset: FeeAsset;
  feeAmount: string;
  creatorShare: string;
  platformShare: string;
  referrerShare: string;
  timestamp: number;
}

export interface RevenueByToken {
  tokenAddress: string;
  tokenSymbol: string;
  events: number;
  creatorShare: bigint;
  referrerShare: bigint;
}

export interface CreatorRevenueSummary {
  address: string;
  role: "creator" | "referrer";
  eventCount: number;
  /** Sum of creator or referrer shares (raw wei / smallest unit). */
  totalShare: string;
  byToken: RevenueByToken[];
  recent: FeeEvent[];
  /** Estimated from DexScreener volume when ledger is sparse. */
  estimated?: boolean;
}

const LEGACY_KEY = "launchpad:fee-events:v1";
const TTL = 60 * 60 * 24 * 365;
const RECENT_KEEP = 50;
const LIMB = BigInt(1_000_000_000_000); // HINCRBY is int64: store each share as hi/lo limbs so a big total can't overflow
const MIGRATED_KEY = "launchpad:fee:migrated:v2";

const MEM_MAX = 5000;
const memEvents: FeeEvent[] = [];

function normalize(addr: string): string {
  return addr.trim().toLowerCase();
}

const seenKey = (e: FeeEvent) => `launchpad:fee:seen:${e.txHash}:${e.creator}:${e.trader}`;
const totalsKey = (role: "creator" | "referrer", addr: string) => `launchpad:fee:tot:${role}:${addr}`;
const recentKey = (role: "creator" | "referrer", addr: string) => `launchpad:fee:recent:${role}:${addr}`;

/** Count one event atomically; false when it was already counted. */
async function storeEvent(redis: Redis, e: FeeEvent): Promise<boolean> {
  const fresh = await redis.set(seenKey(e), "1", "EX", TTL, "NX");
  if (fresh !== "OK") return false;
  const roles: Array<["creator" | "referrer", string, string]> = [["creator", e.creator, e.creatorShare]];
  if (e.referrer) roles.push(["referrer", e.referrer, e.referrerShare]);
  const m = redis.multi();
  for (const [role, addr, shareRaw] of roles) {
    const share = BigInt(shareRaw || "0");
    const t = totalsKey(role, addr);
    m.hincrby(t, `${e.tokenAddress}:n`, 1);
    if (share > BigInt(0)) {
      m.hincrby(t, `${e.tokenAddress}:hi`, Number(share / LIMB));
      m.hincrby(t, `${e.tokenAddress}:lo`, Number(share % LIMB));
    }
    m.hset(t, `${e.tokenAddress}:sym`, e.tokenSymbol);
    m.expire(t, TTL);
    const r = recentKey(role, addr);
    m.lpush(r, JSON.stringify(e));
    m.ltrim(r, 0, RECENT_KEEP - 1);
    m.expire(r, TTL);
  }
  await m.exec();
  return true;
}

/** One-time: replay the old single-blob ledger into the new structures (dedupe makes a re-run harmless). */
async function migrateLegacy(redis: Redis): Promise<void> {
  if (await redis.exists(MIGRATED_KEY)) return;
  const raw = await redis.get(LEGACY_KEY);
  if (raw) {
    const old = (JSON.parse(raw) as FeeEvent[]).slice().reverse(); // oldest first so recent lists end up newest-first
    for (const e of old) await storeEvent(redis, e);
    await redis.expire(LEGACY_KEY, 60 * 60 * 24 * 14);
  }
  await redis.set(MIGRATED_KEY, "1", "EX", TTL);
}

export async function recordFeeEvent(
  event: Omit<FeeEvent, "id" | "timestamp"> & { timestamp?: number }
): Promise<FeeEvent> {
  const entry: FeeEvent = {
    ...event,
    id: `${event.txHash}-${event.creator}-${Date.now()}`,
    tokenAddress: normalize(event.tokenAddress),
    trader: normalize(event.trader),
    creator: normalize(event.creator),
    referrer: event.referrer ? normalize(event.referrer) : null,
    timestamp: event.timestamp ?? Date.now(),
  };

  const redis = await getReadyRedis();
  if (redis) {
    try {
      await migrateLegacy(redis);
      await storeEvent(redis, entry);
      return entry;
    } catch (e) {
      console.warn("[fee-ledger] Redis write failed, kept in memory:", e);
    }
  }
  if (
    !memEvents.some((e) => e.txHash === entry.txHash && e.creator === entry.creator && e.trader === entry.trader)
  ) {
    memEvents.unshift(entry);
    memEvents.length = Math.min(memEvents.length, MEM_MAX);
  }
  return entry;
}

function sumShares(
  events: FeeEvent[],
  role: "creator" | "referrer",
  address: string
): { total: bigint; byToken: Map<string, RevenueByToken> } {
  const addr = normalize(address);
  let total = BigInt(0);
  const byToken = new Map<string, RevenueByToken>();

  for (const e of events) {
    const isCreator = role === "creator" && e.creator === addr;
    const isReferrer = role === "referrer" && e.referrer === addr;
    if (!isCreator && !isReferrer) continue;

    const share = BigInt(isCreator ? e.creatorShare : e.referrerShare);
    if (share <= BigInt(0)) continue;
    total += share;

    const key = e.tokenAddress;
    const prev = byToken.get(key);
    if (prev) {
      prev.events += 1;
      if (isCreator) prev.creatorShare += share;
      else prev.referrerShare += share;
    } else {
      byToken.set(key, {
        tokenAddress: key,
        tokenSymbol: e.tokenSymbol,
        events: 1,
        creatorShare: isCreator ? share : BigInt(0),
        referrerShare: isReferrer ? share : BigInt(0),
      });
    }
  }

  return { total, byToken };
}

async function summarize(role: "creator" | "referrer", address: string): Promise<CreatorRevenueSummary> {
  const addr = normalize(address);
  const redis = await getReadyRedis();
  if (redis) {
    try {
      await migrateLegacy(redis);
      const [fields, recentRaw] = await Promise.all([
        redis.hgetall(totalsKey(role, addr)),
        redis.lrange(recentKey(role, addr), 0, 19),
      ]);
      const tokens = new Map<string, { n: number; hi: bigint; lo: bigint; sym: string }>();
      for (const [f, v] of Object.entries(fields)) {
        const i = f.lastIndexOf(":");
        const token = f.slice(0, i);
        const t = tokens.get(token) ?? { n: 0, hi: BigInt(0), lo: BigInt(0), sym: "" };
        const kind = f.slice(i + 1);
        if (kind === "n") t.n = Number(v);
        else if (kind === "hi") t.hi = BigInt(v);
        else if (kind === "lo") t.lo = BigInt(v);
        else if (kind === "sym") t.sym = v;
        tokens.set(token, t);
      }
      let total = BigInt(0);
      let eventCount = 0;
      const byToken: RevenueByToken[] = [];
      for (const [tokenAddress, t] of tokens) {
        const share = t.hi * LIMB + t.lo;
        total += share;
        eventCount += t.n;
        byToken.push({
          tokenAddress,
          tokenSymbol: t.sym,
          events: t.n,
          creatorShare: role === "creator" ? share : BigInt(0),
          referrerShare: role === "referrer" ? share : BigInt(0),
        });
      }
      const key = role === "creator" ? "creatorShare" : "referrerShare";
      byToken.sort((a, b) => (b[key] > a[key] ? 1 : b[key] < a[key] ? -1 : 0));
      return {
        address: addr,
        role,
        eventCount,
        totalShare: total.toString(),
        byToken,
        recent: recentRaw.map((r) => JSON.parse(r) as FeeEvent),
      };
    } catch (e) {
      console.warn("[fee-ledger] Redis read failed, using memory:", e);
    }
  }
  const mine = memEvents.filter((e) => (role === "creator" ? e.creator === addr : e.referrer === addr));
  const { total, byToken } = sumShares(memEvents, role, addr);
  const key = role === "creator" ? "creatorShare" : "referrerShare";
  return {
    address: addr,
    role,
    eventCount: mine.length,
    totalShare: total.toString(),
    byToken: [...byToken.values()].sort((a, b) => (b[key] > a[key] ? 1 : b[key] < a[key] ? -1 : 0)),
    recent: mine.slice(0, 20),
  };
}

export const getCreatorRevenue = (address: string) => summarize("creator", address);
export const getReferrerRevenue = (address: string) => summarize("referrer", address);
