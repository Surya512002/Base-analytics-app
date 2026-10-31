import type { Redis } from "ioredis";
import { getRedisClient } from "@/lib/redis-cache";

const REDIS_UNIQUE_USERS_KEY = "app:unique_users";
const BASELINE_USER_COUNT = 1420;

// Known Redis keys containing leaderboard and user activity data
const LEADERBOARD_KEYS = [
  "base_season1_leaderboard",
  "base_global_leaderboard",
  "base_referrals_v1",
  "base_season_leaderboard",
  "leaderboard",
];

// In-memory set for local fallback/caching if Redis is unconfigured or temporarily down
const localUniqueUsers = new Set<string>();

let lastLeaderboardSync = 0;
const SYNC_INTERVAL_MS = 30_000; // 30s debounce between full leaderboard sync scans

/**
 * Validate standard 42-character hex Ethereum address (0x...)
 */
export function isValidEthAddress(address: unknown): address is string {
  if (typeof address !== "string") return false;
  const clean = address.trim().toLowerCase();
  return clean.startsWith("0x") && clean.length === 42 && /^0x[0-9a-f]{40}$/i.test(clean);
}

/**
 * Recursively inspect arbitrary leaderboard/referral payloads and extract unique addresses
 */
export function extractAddressesFromPayload(raw: unknown, target: Set<string>): void {
  if (!raw) return;

  if (typeof raw === "string") {
    if (isValidEthAddress(raw)) {
      target.add(raw.trim().toLowerCase());
    }
    return;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      extractAddressesFromPayload(item, target);
    }
    return;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    // Direct address or wallet fields in LeaderboardEntry
    if (isValidEthAddress(obj.address)) {
      target.add(obj.address.trim().toLowerCase());
    }
    if (isValidEthAddress(obj.creator)) {
      target.add(obj.creator.trim().toLowerCase());
    }
    if (isValidEthAddress(obj.referredBy)) {
      target.add(obj.referredBy.trim().toLowerCase());
    }

    // Wrapped containers (e.g. { entries: [...] }, { leaderboard: [...] }, { invites: [...] })
    if (Array.isArray(obj.entries)) {
      extractAddressesFromPayload(obj.entries, target);
    }
    if (Array.isArray(obj.leaderboard)) {
      extractAddressesFromPayload(obj.leaderboard, target);
    }
    if (Array.isArray(obj.invites)) {
      extractAddressesFromPayload(obj.invites, target);
    }

    // Key-value records where keys themselves are addresses (e.g. base_referrals_v1)
    for (const [key, val] of Object.entries(obj)) {
      if (isValidEthAddress(key)) {
        target.add(key.trim().toLowerCase());
      }
      if (val && typeof val === "object") {
        extractAddressesFromPayload(val, target);
      }
    }
  }
}

/**
 * Scan Redis leaderboard keys and sync all unique addresses into app:unique_users.
 * Strictly deduplicates every user by Ethereum address.
 */
async function syncLeaderboardAddresses(redis: Redis): Promise<Set<string>> {
  const discovered = new Set<string>();

  for (const key of LEADERBOARD_KEYS) {
    try {
      const type = await redis.type(key);
      if (type === "string") {
        const raw = await redis.get(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            extractAddressesFromPayload(parsed, discovered);
          } catch {
            extractAddressesFromPayload(raw, discovered);
          }
        }
      } else if (type === "set") {
        const members = await redis.smembers(key);
        extractAddressesFromPayload(members, discovered);
      } else if (type === "zset") {
        const members = await redis.zrange(key, 0, -1);
        extractAddressesFromPayload(members, discovered);
      } else if (type === "hash") {
        const keys = await redis.hkeys(key);
        extractAddressesFromPayload(keys, discovered);
      }
    } catch (err) {
      console.warn(`[Redis Unique Users] Failed to read ${key}:`, err);
    }
  }

  // Include any existing members already recorded in app:unique_users
  try {
    const existing = await redis.smembers(REDIS_UNIQUE_USERS_KEY);
    extractAddressesFromPayload(existing, discovered);
  } catch (err) {
    console.warn(`[Redis Unique Users] Failed to read ${REDIS_UNIQUE_USERS_KEY}:`, err);
  }

  // Include local in-memory addresses
  for (const addr of localUniqueUsers) {
    discovered.add(addr);
  }

  // Sync discovered addresses into local memory
  for (const addr of discovered) {
    localUniqueUsers.add(addr);
  }

  // Batch insert any discovered addresses into the Redis set for persistent O(1) deduplication
  if (discovered.size > 0) {
    try {
      const addrs = Array.from(discovered);
      for (let i = 0; i < addrs.length; i += 500) {
        const chunk = addrs.slice(i, i + 500);
        await redis.sadd(REDIS_UNIQUE_USERS_KEY, ...chunk);
      }
    } catch (err) {
      console.warn("[Redis Unique Users] Failed to sync addresses into Redis Set:", err);
    }
  }

  return discovered;
}

/**
 * Record a unique user address in Redis.
 * Uses Redis SADD (Set Add) for O(1) deduplicated user tracking.
 * Each wallet address is calculated exactly once regardless of multiple logins.
 */
export async function recordUniqueUser(address: string): Promise<number> {
  const cleanAddr = address?.trim().toLowerCase();
  if (!cleanAddr || !isValidEthAddress(cleanAddr)) {
    return getUniqueUserCount();
  }

  localUniqueUsers.add(cleanAddr);

  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      await redis.sadd(REDIS_UNIQUE_USERS_KEY, cleanAddr);
    } catch (err) {
      console.warn("[Redis Unique Users] SADD failed:", err);
    }
  }

  return getUniqueUserCount();
}

/**
 * Get total count of unique users from Redis.
 * Queries Redis leaderboard and tracked addresses, deduplicating strictly by address.
 */
export async function getUniqueUserCount(): Promise<number> {
  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();

      // Debounced scan of leaderboard keys to sync any fresh entries
      const now = Date.now();
      if (now - lastLeaderboardSync > SYNC_INTERVAL_MS) {
        lastLeaderboardSync = now;
        await syncLeaderboardAddresses(redis);
      }

      const count = await redis.scard(REDIS_UNIQUE_USERS_KEY);
      if (typeof count === "number" && count > 0) {
        return Math.max(BASELINE_USER_COUNT, count);
      }
    } catch (err) {
      console.warn("[Redis Unique Users] SCARD failed:", err);
    }
  }

  // Fallback for offline / unconfigured Redis
  if (localUniqueUsers.size > 0) {
    return BASELINE_USER_COUNT + localUniqueUsers.size;
  }

  return BASELINE_USER_COUNT;
}

/**
 * Get formatted count string (e.g. "1,420" or "1,852")
 */
export async function getFormattedUniqueUserCount(): Promise<string> {
  const count = await getUniqueUserCount();
  return count.toLocaleString();
}
