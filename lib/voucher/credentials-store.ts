import { getRedisClient, ensureRedisReady } from "@/lib/redis-cache";
import { readDiskJson, writeDiskJson } from "@/lib/utils/disk-store";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import { isSealed, openJson, sealJson } from "@/lib/voucher/secret-box";

const credentialsKey = (creator: string) =>
  `base_voucher_credentials_${creator.toLowerCase()}`;

const DISK_FILE = "voucher-credentials.json";

/**
 * What sits in Redis / on disk for one creator: either a sealed string (encryption at rest,
 * see secret-box.ts) or, for records written before it was configured, the plain array.
 */
type StoredRecord = string | StoredVoucherBatch[];

// In-memory cache of opened records, keyed by creator address
const memoryCredentials = new Map<string, StoredVoucherBatch[]>();

/** Seal for storage when a key is configured; otherwise keep the plain array. */
export function encodeCredentials(creator: string, batches: StoredVoucherBatch[]): StoredRecord {
  return sealJson(batches, creator) ?? batches;
}

/**
 * Open a stored record. `needsReseal` is true for plaintext records while a key is configured,
 * so the caller can migrate them. A sealed record no key can open reads as empty.
 */
export function decodeCredentials(
  creator: string,
  record: unknown
): { batches: StoredVoucherBatch[]; needsReseal: boolean } {
  if (Array.isArray(record)) {
    return { batches: record as StoredVoucherBatch[], needsReseal: isSealed(sealJson([], creator)) };
  }
  if (isSealed(record)) {
    try {
      return { batches: openJson<StoredVoucherBatch[]>(record, creator), needsReseal: false };
    } catch (err) {
      console.error("[voucher credentials] sealed record can't be opened; check VOUCHER_SECRETS_KEY", err);
      return { batches: [], needsReseal: false };
    }
  }
  return { batches: [], needsReseal: false };
}

function readDiskRecord(creator: string): unknown {
  return readDiskJson<Record<string, StoredRecord>>(DISK_FILE, {})[creator];
}

function writeDisk(creator: string, record: StoredRecord | null): void {
  const all = readDiskJson<Record<string, StoredRecord>>(DISK_FILE, {});
  if (record === null) delete all[creator];
  else all[creator] = record;
  writeDiskJson(DISK_FILE, all);
}

async function writeRedis(creator: string, record: StoredRecord | null): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await ensureRedisReady(redis);
    if (record === null) await redis.del(credentialsKey(creator));
    else await redis.set(credentialsKey(creator), JSON.stringify(record));
  } catch (err) {
    console.warn("[voucher credentials] Redis write failed, kept in local store:", err);
  }
}

/** Persist everywhere: memory, disk, Redis. */
async function persist(creator: string, batches: StoredVoucherBatch[]): Promise<void> {
  memoryCredentials.set(creator, batches);
  const record = encodeCredentials(creator, batches);
  writeDisk(creator, record);
  await writeRedis(creator, record);
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
      await ensureRedisReady(redis);
      const raw = await redis.get(credentialsKey(normalized));
      if (raw) {
        const { batches, needsReseal } = decodeCredentials(normalized, JSON.parse(raw));
        memoryCredentials.set(normalized, batches);
        // Migrate plaintext records (and refresh the disk copy) now that a key is configured.
        if (needsReseal) await persist(normalized, batches);
        else writeDisk(normalized, JSON.parse(raw) as StoredRecord);
        return batches;
      }
    }
  } catch (err) {
    console.warn("[readCreatorCredentials] Redis lookup failed, using local store:", err);
  }

  // Fallback to local memory / disk store
  const cached = memoryCredentials.get(normalized);
  if (cached) return cached;
  const { batches, needsReseal } = decodeCredentials(normalized, readDiskRecord(normalized));
  memoryCredentials.set(normalized, batches);
  if (needsReseal) writeDisk(normalized, encodeCredentials(normalized, batches));
  return batches;
}

/** Remove every saved secret for a creator (used when they move to a private vault). */
export async function deleteCreatorCredentials(creator: string): Promise<void> {
  const normalized = creator?.toLowerCase();
  if (!normalized) return;
  memoryCredentials.delete(normalized);
  writeDisk(normalized, null);
  await writeRedis(normalized, null);
}

/**
 * Index of the stored record for `entry`. Batch ids repeat across contracts, so a record with a
 * contract only matches the same contract. A legacy record saved without a contract matches by
 * id and is upgraded in place (callers only upsert after onchain verification).
 */
export function findStoredBatchIndex(
  existing: readonly StoredVoucherBatch[],
  entry: Pick<StoredVoucherBatch, "batchId" | "contractAddress">
): number {
  const contract = entry.contractAddress?.toLowerCase();
  const exact = existing.findIndex(
    (b) => b.batchId === entry.batchId && (b.contractAddress?.toLowerCase() ?? null) === (contract ?? null)
  );
  if (exact >= 0 || !contract) return exact;
  return existing.findIndex((b) => b.batchId === entry.batchId && !b.contractAddress);
}

/**
 * Save card secrets for a creator. Callers MUST have checked the secrets against the onchain
 * hashes first (`verifyBatchCredentials`) and authenticated the creator (SIWE).
 */
export async function upsertCreatorBatch(
  creator: string,
  batch: StoredVoucherBatch
): Promise<boolean> {
  const normalized = creator?.toLowerCase();
  if (!normalized) return false;

  const existing = [...(await readCreatorCredentials(normalized))];
  const entry: StoredVoucherBatch = {
    ...batch,
    creator: normalized,
    contractAddress: batch.contractAddress?.toLowerCase(),
  };

  const secretFrom = (cards: StoredVoucherBatch["cards"], cardIndex: number) =>
    cards.find((c) => c.cardIndex === cardIndex)?.secret?.trim() || "";

  const idx = findStoredBatchIndex(existing, entry);
  if (idx >= 0) {
    const prev = existing[idx]!;
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

  await persist(normalized, existing);
  return true;
}
