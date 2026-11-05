import { getRedisClient } from "@/lib/redis-cache";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const REDIS_UNIQUE_USERS_KEY = "app:unique_users";
const REDIS_VERIFIED_TXS_KEY = "app:verified_tx_hashes";
const BASELINE_USER_COUNT = 0; // Strict zero-padding: count only confirmed on-chain in-app transactions

// In-memory set for local fallback/caching if Redis is unconfigured or temporarily down
const localUniqueUsers = new Set<string>();
const localVerifiedTxs = new Set<string>();

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
 * Record a verified unique user address in Redis.
 * Uses Redis SADD (Set Add) for O(1) deduplicated user tracking.
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
 * Verify a confirmed on-chain transaction on Base mainnet (chainId: 8453)
 * and record the transaction sender as a verified unique user.
 */
export async function verifyAndRecordUserTransaction(
  address: string,
  txHash: string,
  customRpcUrl?: string
): Promise<{ success: boolean; count: number; error?: string }> {
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
      if (redis.status !== "ready") await redis.connect();
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

  // Verify on Base RPC that the transaction succeeded and originated from the claimed address
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

    if (receipt.from.toLowerCase() !== cleanAddr) {
      return {
        success: false,
        count: await getUniqueUserCount(),
        error: `Transaction sender (${receipt.from.toLowerCase()}) does not match claiming address (${cleanAddr})`,
      };
    }

    // Record verified txHash and address
    localVerifiedTxs.add(cleanTx);
    localUniqueUsers.add(cleanAddr);

    if (redis) {
      try {
        await Promise.all([
          redis.sadd(REDIS_VERIFIED_TXS_KEY, cleanTx),
          redis.sadd(REDIS_UNIQUE_USERS_KEY, cleanAddr),
        ]);
      } catch (err) {
        console.warn("[Redis Unique Users] Failed to save verified tx/user to Redis:", err);
      }
    }

    const count = await getUniqueUserCount();
    return { success: true, count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RPC error verifying transaction";
    return { success: false, count: await getUniqueUserCount(), error: msg };
  }
}

/**
 * Get total count of unique users from Redis.
 * Deduplicates strictly by Ethereum address.
 */
export async function getUniqueUserCount(): Promise<number> {
  const redis = getRedisClient();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      const count = await redis.scard(REDIS_UNIQUE_USERS_KEY);
      if (typeof count === "number") {
        return BASELINE_USER_COUNT + count;
      }
    } catch (err) {
      console.warn("[Redis Unique Users] SCARD failed:", err);
    }
  }

  return BASELINE_USER_COUNT + localUniqueUsers.size;
}

/**
 * Get formatted count string (e.g. "0" or "42")
 */
export async function getFormattedUniqueUserCount(): Promise<string> {
  const count = await getUniqueUserCount();
  return count.toLocaleString();
}
