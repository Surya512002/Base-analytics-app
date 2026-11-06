import { getRedisClient } from "@/lib/redis-cache";
import { readDiskJson, writeDiskJson } from "@/lib/utils/disk-store";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";

const credentialsKey = (creator: string) =>
  `base_voucher_credentials_${creator.toLowerCase()}`;

const DISK_FILE = "voucher-credentials.json";

// In-memory cache keyed by creator address
const memoryCredentials = new Map<string, StoredVoucherBatch[]>();

function getLocalCredentials(creator: string): StoredVoucherBatch[] {
  const normalized = creator.toLowerCase();
  if (memoryCredentials.has(normalized)) {
    return memoryCredentials.get(normalized)!;
  }
  const allFromDisk = readDiskJson<Record<string, StoredVoucherBatch[]>>(DISK_FILE, {});
  const batches = allFromDisk[normalized] || [];
  memoryCredentials.set(normalized, batches);
  return batches;
}

function saveLocalCredentials(creator: string, batches: StoredVoucherBatch[]): void {
  const normalized = creator.toLowerCase();
  memoryCredentials.set(normalized, batches);
  const allFromDisk = readDiskJson<Record<string, StoredVoucherBatch[]>>(DISK_FILE, {});
  allFromDisk[normalized] = batches;
  writeDiskJson(DISK_FILE, allFromDisk);
}

export async function readCreatorCredentials(
  creator: string
): Promise<StoredVoucherBatch[]> {
  const normalized = creator?.toLowerCase();
  if (!normalized) return [];

  // Try Redis first
  try {
    const redis = getRedisClient();
    if (redis) {
      if (redis.status !== "ready") await redis.connect();
      const raw = await redis.get(credentialsKey(normalized));
      if (raw) {
        const parsed = JSON.parse(raw) as StoredVoucherBatch[];
        saveLocalCredentials(normalized, parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[readCreatorCredentials] Redis lookup failed, using local store:", err);
  }

  // Fallback to local memory / disk store
  return getLocalCredentials(normalized);
}

export async function upsertCreatorBatch(
  creator: string,
  batch: StoredVoucherBatch
): Promise<boolean> {
  const normalized = creator?.toLowerCase();
  if (!normalized) return false;

  const existing = await readCreatorCredentials(normalized);
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

  // Always persist locally first so data is never lost
  saveLocalCredentials(normalized, existing);

  // Try updating Redis as well
  try {
    const redis = getRedisClient();
    if (redis) {
      if (redis.status !== "ready") await redis.connect();
      await redis.set(credentialsKey(normalized), JSON.stringify(existing));
    }
  } catch (err) {
    console.warn("[upsertCreatorBatch] Redis set failed, kept in local store:", err);
  }

  return true;
}
