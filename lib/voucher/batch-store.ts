import { getRedisClient, ensureRedisReady } from "@/lib/redis-cache";
import { readDiskJson, writeDiskJson } from "@/lib/utils/disk-store";
import type { VoucherBatchMeta } from "@/lib/types/voucher";

const DB_KEY = "base_voucher_batches";
const DISK_FILE = "voucher-batches.json";

let memoryBatches: VoucherBatchMeta[] | null = null;

export async function readStoredBatches(): Promise<VoucherBatchMeta[]> {
  // Try Redis first
  try {
    const redis = getRedisClient();
    if (redis) {
      await ensureRedisReady(redis);
      const raw = await redis.get(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VoucherBatchMeta[];
        memoryBatches = parsed;
        writeDiskJson(DISK_FILE, parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn("[Voucher batch-store] Redis read failed, falling back to local:", e);
  }

  // Fallback to memory or disk
  if (memoryBatches !== null) {
    return memoryBatches;
  }
  memoryBatches = readDiskJson<VoucherBatchMeta[]>(DISK_FILE, []);
  return memoryBatches;
}

export async function writeStoredBatches(batches: VoucherBatchMeta[]): Promise<void> {
  memoryBatches = batches;
  writeDiskJson(DISK_FILE, batches);

  try {
    const redis = getRedisClient();
    if (redis) {
      await ensureRedisReady(redis);
      await redis.set(DB_KEY, JSON.stringify(batches));
    }
  } catch (e) {
    console.warn("[Voucher batch-store] Redis write failed, kept in local store:", e);
  }
}
