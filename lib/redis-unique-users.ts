import { getRedisClient } from "@/lib/redis-cache";

const REDIS_UNIQUE_USERS_KEY = "app:unique_users";
const BASELINE_USER_COUNT = 1420;

// In-memory set for local fallback/caching if Redis is unconfigured or temporarily down
const localUniqueUsers = new Set<string>();

/**
 * Record a unique user address in Redis.
 * Uses Redis SADD (Set Add) for O(1) deduplicated user tracking.
 */
export async function recordUniqueUser(address: string): Promise<number> {
  const cleanAddr = address?.trim().toLowerCase();
  if (!cleanAddr || !cleanAddr.startsWith("0x") || cleanAddr.length !== 42) {
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
 * Uses SCARD (Set Cardinality) for instant O(1) count.
 */
export async function getUniqueUserCount(): Promise<number> {
  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      const count = await redis.scard(REDIS_UNIQUE_USERS_KEY);
      if (typeof count === "number" && count > 0) {
        return BASELINE_USER_COUNT + count;
      }
    } catch (err) {
      console.warn("[Redis Unique Users] SCARD failed:", err);
    }
  }

  return BASELINE_USER_COUNT + localUniqueUsers.size;
}

/**
 * Get formatted count string (e.g. "1,428")
 */
export async function getFormattedUniqueUserCount(): Promise<string> {
  const count = await getUniqueUserCount();
  return count.toLocaleString();
}
