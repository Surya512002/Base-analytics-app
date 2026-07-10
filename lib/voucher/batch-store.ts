import { Redis } from "ioredis";
import type { VoucherBatchMeta } from "@/lib/types/voucher";

const DB_KEY = "base_voucher_batches";

function createRedis(): Redis | null {
  const url = process.env.KV_REDIS_URL?.trim();
  if (!url) return null;
  const client = new Redis(url, {
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    commandTimeout: 5000,
    enableReadyCheck: false,
  });
  client.on("error", (e) => console.error("[Voucher Redis]", e.message));
  return client;
}

export async function readStoredBatches(): Promise<VoucherBatchMeta[]> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    if (!redis) return [];
    await redis.connect();
    const raw = await redis.get(DB_KEY);
    return raw ? (JSON.parse(raw) as VoucherBatchMeta[]) : [];
  } catch (e) {
    console.error("[Voucher batch-store] read failed", e);
    return [];
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}

export async function writeStoredBatches(batches: VoucherBatchMeta[]): Promise<void> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    if (!redis) return;
    await redis.connect();
    await redis.set(DB_KEY, JSON.stringify(batches));
  } catch (e) {
    console.error("[Voucher batch-store] write failed", e);
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}
