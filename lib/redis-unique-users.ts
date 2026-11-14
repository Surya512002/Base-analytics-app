import { getRedisClient, ensureRedisReady } from "@/lib/redis-cache";
import { readDiskJson, writeDiskJson } from "@/lib/utils/disk-store";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const REDIS_UNIQUE_USERS_KEY = "app:unique_users";
const REDIS_VERIFIED_TXS_KEY = "app:verified_tx_hashes";
const DISK_USERS_FILE = "unique-users.json";
const DISK_TXS_FILE = "verified-txs.json";

// Seed active onchain creators on Base mainnet (Voucher creators & deployers)
const INITIAL_ONCHAIN_CREATORS = [
  "0xb4bd7d410543cb27f42c562ab3ff5dc12fbdd42f",
  "0xbcddd1bc8f3c0c24bedee41720287ff50a7b7148",
  "0xc63177ef5e738d65020723f5ce64dc5e8dd9c5c2",
];

// Daily activity: one set of wallets per UTC day, plus a "new wallets" counter per day.
const DAY_USERS_PREFIX = "app:active_users:";
const DAY_NEW_PREFIX = "app:new_users:";
const DAY_TTL_SECONDS = 8 * 86_400;

/** UTC day key, e.g. "2026-11-14". */
export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The last `n` UTC days, oldest first. */
export function lastUtcDays(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => utcDay(new Date(now.getTime() - (n - 1 - i) * 86_400_000)));
}

const localDayUsers = new Map<string, Set<string>>();
const localDayNew = new Map<string, number>();

// In-memory set for local fallback/caching if Redis is unconfigured or temporarily down
const localUniqueUsers = new Set<string>();
const localVerifiedTxs = new Set<string>();

let initialized = false;

function initLocalCache() {
  if (initialized) return;
  initialized = true;

  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }

  const diskUsers = readDiskJson<string[]>(DISK_USERS_FILE, []);
  for (const u of diskUsers) localUniqueUsers.add(u.toLowerCase());

  const diskTxs = readDiskJson<string[]>(DISK_TXS_FILE, []);
  for (const t of diskTxs) localVerifiedTxs.add(t.toLowerCase());

  // Seed onchain creators if empty so count reflects live protocol creators
  if (localUniqueUsers.size === 0) {
    for (const c of INITIAL_ONCHAIN_CREATORS) {
      localUniqueUsers.add(c.toLowerCase());
    }
    writeDiskJson(DISK_USERS_FILE, [...localUniqueUsers]);
  }
}

/**
 * Validate standard 42-character hex Ethereum address (0x...)
 */
export function isValidEthAddress(address: unknown): address is string {
  if (typeof address !== "string") return false;
  const clean = address.trim().toLowerCase();
  return clean.startsWith("0x") && clean.length === 42 && /^0x[0-9a-f]{40}$/i.test(clean);
}

/**
 * Validate standard 66-character hex Ethereum transaction hash (0x...)
 */
export function isValidTxHash(txHash: unknown): txHash is `0x${string}` {
  if (typeof txHash !== "string") return false;
  const clean = txHash.trim().toLowerCase();
  return clean.startsWith("0x") && clean.length === 66 && /^0x[0-9a-f]{64}$/i.test(clean);
}

/**
 * Mark a wallet active today (and count it as new if it has never been seen).
 * `isNew` is whether the all-time set just gained this wallet.
 */
async function markActiveToday(
  redis: ReturnType<typeof getRedisClient>,
  addr: string,
  isNew: boolean
): Promise<void> {
  const day = utcDay();
  if (!localDayUsers.has(day)) localDayUsers.set(day, new Set());
  localDayUsers.get(day)!.add(addr);
  if (isNew) localDayNew.set(day, (localDayNew.get(day) ?? 0) + 1);
  if (!redis) return;
  try {
    const dayKey = DAY_USERS_PREFIX + day;
    const ops: Array<Promise<unknown>> = [redis.sadd(dayKey, addr), redis.expire(dayKey, DAY_TTL_SECONDS)];
    if (isNew) {
      const newKey = DAY_NEW_PREFIX + day;
      ops.push(redis.incr(newKey), redis.expire(newKey, DAY_TTL_SECONDS));
    }
    await Promise.all(ops);
  } catch (err) {
    console.warn("[Redis Unique Users] daily activity write failed:", err);
  }
}

/**
 * Record a verified unique user address in Redis and local persistent storage.
 * Uses Redis SADD (Set Add) for O(1) deduplicated user tracking.
 */
export async function recordUniqueUser(address: string): Promise<number> {
  initLocalCache();
  const cleanAddr = address?.trim().toLowerCase();
  if (!cleanAddr || !isValidEthAddress(cleanAddr)) {
    return getUniqueUserCount();
  }

  const wasKnownLocally = localUniqueUsers.has(cleanAddr);
  localUniqueUsers.add(cleanAddr);
  if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    writeDiskJson(DISK_USERS_FILE, [...localUniqueUsers]);
  }

  const redis = getRedisClient();
  let isNew = !wasKnownLocally;
  if (redis) {
    try {
      await ensureRedisReady(redis);
      isNew = (await redis.sadd(REDIS_UNIQUE_USERS_KEY, cleanAddr)) === 1;
    } catch (err) {
      console.warn("[Redis Unique Users] SADD failed:", err);
    }
  }
  await markActiveToday(redis, cleanAddr, isNew);

  return getUniqueUserCount();
}

/**
 * Verify a confirmed on-chain transaction on Base mainnet (chainId: 8453)
 * Supports EOAs, Coinbase Smart Wallets (ERC-4337), and Paymaster bundlers.
 */
export async function verifyAndRecordUserTransaction(
  address: string,
  txHash: string,
  customRpcUrl?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  initLocalCache();
  const cleanAddr = address?.trim().toLowerCase();
  if (!isValidEthAddress(cleanAddr)) {
    return { success: false, count: await getUniqueUserCount(), error: "Invalid Ethereum address format" };
  }

  if (!isValidTxHash(txHash)) {
    return { success: false, count: await getUniqueUserCount(), error: "Invalid transaction hash format" };
  }

  const cleanTx = txHash.trim().toLowerCase();

  // Check if txHash was already used for verification to prevent duplicate replay attempts
  const redis = getRedisClient();
  if (redis) {
    try {
      await ensureRedisReady(redis);
      const alreadyUsed = await redis.sismember(REDIS_VERIFIED_TXS_KEY, cleanTx);
      if (alreadyUsed) {
        return { success: true, count: await getUniqueUserCount() };
      }
    } catch {
      // Continue to on-chain check
    }
  } else if (localVerifiedTxs.has(cleanTx)) {
    return { success: true, count: await getUniqueUserCount() };
  }

  // Verify on Base RPC that the transaction succeeded
  const rpcUrl = customRpcUrl || process.env.BASE_RPC_URL || "https://mainnet.base.org";
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 8_000 }),
  });

  try {
    const receipt = await client.getTransactionReceipt({ hash: cleanTx as `0x${string}` });
    if (!receipt) {
      return { success: false, count: await getUniqueUserCount(), error: "Transaction receipt not found on Base mainnet" };
    }

    if (receipt.status !== "success") {
      return { success: false, count: await getUniqueUserCount(), error: "Transaction reverted or failed onchain" };
    }

    // Verify participant: Check direct EOA sender, recipient, or ERC-4337 smart wallet userOp logs
    const cleanTopic = cleanAddr.slice(2).toLowerCase();
    const isLogParticipant = receipt.logs.some((l) =>
      l.topics.some((t) => typeof t === "string" && t.toLowerCase().includes(cleanTopic))
    );
    const isDirectParticipant =
      receipt.from.toLowerCase() === cleanAddr ||
      receipt.to?.toLowerCase() === cleanAddr ||
      isLogParticipant;

    if (!isDirectParticipant) {
      return {
        success: false,
        count: await getUniqueUserCount(),
        error: `Transaction sender (${receipt.from.toLowerCase()}) does not match claiming address (${cleanAddr})`,
      };
    }

    // Record verified txHash and address
    localVerifiedTxs.add(cleanTx);
    localUniqueUsers.add(cleanAddr);
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      writeDiskJson(DISK_USERS_FILE, [...localUniqueUsers]);
      writeDiskJson(DISK_TXS_FILE, [...localVerifiedTxs]);
    }

    let isNew = false;
    if (redis) {
      try {
        const [, added] = await Promise.all([
          redis.sadd(REDIS_VERIFIED_TXS_KEY, cleanTx),
          redis.sadd(REDIS_UNIQUE_USERS_KEY, cleanAddr),
        ]);
        isNew = added === 1;
      } catch (err) {
        console.warn("[Redis Unique Users] Failed to save verified tx/user to Redis:", err);
      }
    }
    await markActiveToday(redis, cleanAddr, isNew);

    const count = await getUniqueUserCount();
    return { success: true, count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RPC error verifying transaction";
    return { success: false, count: await getUniqueUserCount(), error: msg };
  }
}

/**
 * Get total count of unique users from Redis with resilient local fallback.
 * Deduplicates strictly by Ethereum address.
 */
export async function getUniqueUserCount(): Promise<number> {
  initLocalCache();

  const redis = getRedisClient();
  if (redis) {
    try {
      await ensureRedisReady(redis);
      const count = await redis.scard(REDIS_UNIQUE_USERS_KEY);
      if (typeof count === "number" && count > 0) {
        return count;
      }
      if (typeof count === "number" && count === 0) {
        if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
          try {
            await redis.sadd(REDIS_UNIQUE_USERS_KEY, ...INITIAL_ONCHAIN_CREATORS);
            return INITIAL_ONCHAIN_CREATORS.length;
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.warn("[Redis Unique Users] SCARD failed:", err);
    }
  }

  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return localUniqueUsers.size;
  }

  return Math.max(localUniqueUsers.size, INITIAL_ONCHAIN_CREATORS.length);
}

/**
 * Get formatted count string (e.g. "3" or "42")
 */
export async function getFormattedUniqueUserCount(): Promise<string> {
  const count = await getUniqueUserCount();
  return count.toLocaleString();
}

export type UserActivityStats = {
  /** All-time unique wallets. */
  total: number;
  /** Unique wallets active today (UTC). */
  today: number;
  /** Wallets seen for the first time today. */
  newToday: number;
  /** Unique wallets per day for the last 7 days, oldest first (last item = today). */
  last7: Array<{ day: string; users: number }>;
  /** Where the numbers came from. */
  source: "redis" | "local";
};

/** Total + today + new today + 7-day series, from Redis (or the local fallback). */
export async function getUserActivityStats(): Promise<UserActivityStats> {
  const total = await getUniqueUserCount();
  const days = lastUtcDays(7);
  const today = days[days.length - 1];
  const redis = getRedisClient();
  if (redis) {
    try {
      await ensureRedisReady(redis);
      const [counts, newToday] = await Promise.all([
        Promise.all(days.map((d) => redis.scard(DAY_USERS_PREFIX + d))),
        redis.get(DAY_NEW_PREFIX + today),
      ]);
      return {
        total,
        today: counts[counts.length - 1] ?? 0,
        newToday: Number(newToday ?? 0) || 0,
        last7: days.map((day, i) => ({ day, users: counts[i] ?? 0 })),
        source: "redis",
      };
    } catch (err) {
      console.warn("[Redis Unique Users] activity read failed:", err);
    }
  }
  return {
    total,
    today: localDayUsers.get(today)?.size ?? 0,
    newToday: localDayNew.get(today) ?? 0,
    last7: days.map((day) => ({ day, users: localDayUsers.get(day)?.size ?? 0 })),
    source: "local",
  };
}
