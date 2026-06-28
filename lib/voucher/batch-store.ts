import { Redis } from "ioredis";
import type { VoucherBatchMeta } from "@/lib/types/voucher";

const DB_KEY = "base_voucher_batches";

function createRedis(): Redis {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error("KV_REDIS_URL not set");
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
    await redis.connect();
    const raw = await redis.get(DB_KEY);
    return raw ? (JSON.parse(raw) as VoucherBatchMeta[]) : [];
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}

export async function writeStoredBatches(batches: VoucherBatchMeta[]): Promise<void> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    await redis.connect();
    await redis.set(DB_KEY, JSON.stringify(batches));
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}
