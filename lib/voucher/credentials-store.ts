import { getRedisClient } from "@/lib/redis-cache";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";

const credentialsKey = (creator: string) =>
  `base_voucher_credentials_${creator.toLowerCase()}`;

export async function readCreatorCredentials(
  creator: string
): Promise<StoredVoucherBatch[]> {
  try {
    const redis = getRedisClient();
    if (!redis) return [];
    if (redis.status !== "ready") await redis.connect();
    const raw = await redis.get(credentialsKey(creator));
    return raw ? (JSON.parse(raw) as StoredVoucherBatch[]) : [];
  } catch (err) {
    console.error("[readCreatorCredentials]", err);
    return [];
  }
}

export async function upsertCreatorBatch(
  creator: string,
  batch: StoredVoucherBatch
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    if (!redis) return false;
    if (redis.status !== "ready") await redis.connect();
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
  }
}
