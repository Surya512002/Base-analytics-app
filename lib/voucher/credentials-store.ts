import { Redis } from "ioredis";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";

const credentialsKey = (creator: string) =>
  `base_voucher_credentials_${creator.toLowerCase()}`;

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
  client.on("error", (e) => console.error("[Voucher Credentials Redis]", e.message));
  return client;
}

export async function readCreatorCredentials(
  creator: string
): Promise<StoredVoucherBatch[]> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    await redis.connect();
    const raw = await redis.get(credentialsKey(creator));
    return raw ? (JSON.parse(raw) as StoredVoucherBatch[]) : [];
  } catch (err) {
    console.error("[readCreatorCredentials]", err);
    return [];
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}

export async function upsertCreatorBatch(
  creator: string,
  batch: StoredVoucherBatch
): Promise<boolean> {
  let redis: Redis | null = null;
  try {
    redis = createRedis();
    await redis.connect();
    const key = credentialsKey(creator);
    const raw = await redis.get(key);
    const existing = raw ? (JSON.parse(raw) as StoredVoucherBatch[]) : [];
    const normalized = creator.toLowerCase();
    const entry: StoredVoucherBatch = {
      ...batch,
      creator: normalized,
    };

    const secretFrom = (cards: StoredVoucherBatch["cards"], cardIndex: number) =>
      cards.find((c) => c.cardIndex === cardIndex)?.secret?.trim() || "";

    const idx = existing.findIndex((b) => b.batchId === entry.batchId);
    if (idx >= 0) {
      const prev = existing[idx];
      existing[idx] = {
        ...prev,
        ...entry,
        cards: entry.cards.map((c) => ({
          ...c,
          secret: c.secret?.trim() || secretFrom(prev.cards, c.cardIndex),
        })),
      };
    } else {
      existing.unshift(entry);
    }

    await redis.set(key, JSON.stringify(existing));
    return true;
  } catch (err) {
    console.error("[upsertCreatorBatch]", err);
    return false;
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}
