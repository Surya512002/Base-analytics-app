import { getRedisClient } from "@/lib/redis-cache";
import type { VoucherBatchMeta } from "@/lib/types/voucher";

const DB_KEY = "base_voucher_batches";

export async function readStoredBatches(): Promise<VoucherBatchMeta[]> {
  const redis = getRedisClient();
  try {
    if (!redis) return [];
    if (redis.status !== "ready") await redis.connect();
    const raw = await redis.get(DB_KEY);
    return raw ? (JSON.parse(raw) as VoucherBatchMeta[]) : [];
  } catch (e) {
    console.error("[Voucher batch-store] read failed", e);
    return [];
  }
}

export async function writeStoredBatches(batches: VoucherBatchMeta[]): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    if (redis.status !== "ready") await redis.connect();
    await redis.set(DB_KEY, JSON.stringify(batches));
  } catch (e) {
    console.error("[Voucher batch-store] write failed", e);
  }
}
