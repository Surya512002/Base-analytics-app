import { getReadyRedis } from "@/lib/redis-cache";
import { readDiskJson, writeDiskJson } from "@/lib/utils/disk-store";
import type { VoucherBatchMeta } from "@/lib/types/voucher";

// One hash, one field per batch: two creators saving at once no longer overwrite each other's list.
const HASH_KEY = "base_voucher_batches:v2";
const LEGACY_KEY = "base_voucher_batches";
const DISK_FILE = "voucher-batches.json";

let memoryBatches: VoucherBatchMeta[] | null = null;

const fieldOf = (b: Pick<VoucherBatchMeta, "batchId" | "contractAddress">) =>
  `${b.contractAddress?.toLowerCase() ?? "legacy"}:${b.batchId}`;

function memory(): VoucherBatchMeta[] {
  if (memoryBatches === null) memoryBatches = readDiskJson<VoucherBatchMeta[]>(DISK_FILE, []);
  return memoryBatches;
}

/** Copy the old single-blob list into the hash (HSETNX, so a rerun or a race can't clobber newer rows). */
async function migrateLegacy(redis: NonNullable<Awaited<ReturnType<typeof getReadyRedis>>>): Promise<void> {
  const raw = await redis.get(LEGACY_KEY);
  if (!raw) return;
  const m = redis.multi();
  for (const b of JSON.parse(raw) as VoucherBatchMeta[]) m.hsetnx(HASH_KEY, fieldOf(b), JSON.stringify(b));
  await m.exec();
  await redis.expire(LEGACY_KEY, 60 * 60 * 24 * 14);
}

export async function readStoredBatches(): Promise<VoucherBatchMeta[]> {
  try {
    const redis = await getReadyRedis();
    if (redis) {
      if (!(await redis.exists(HASH_KEY))) await migrateLegacy(redis);
      const all = Object.values(await redis.hgetall(HASH_KEY)).map((v) => JSON.parse(v) as VoucherBatchMeta);
      all.sort((a, b) => b.createdAt - a.createdAt);
      memoryBatches = all;
      return all;
    }
  } catch (e) {
    console.warn("[Voucher batch-store] Redis read failed, falling back to local:", e);
  }
  return memory();
}

/** Save one batch record on its own; never rewrites anyone else's. `replaces` is the older row it supersedes (e.g. a record that had no contract yet). */
export async function upsertStoredBatch(batch: VoucherBatchMeta, replaces?: VoucherBatchMeta): Promise<void> {
  const oldField = replaces && fieldOf(replaces) !== fieldOf(batch) ? fieldOf(replaces) : null;
  const local = memory().filter((b) => fieldOf(b) !== oldField);
  const i = local.findIndex((b) => fieldOf(b) === fieldOf(batch));
  if (i >= 0) local[i] = batch;
  else local.unshift(batch);
  memoryBatches = local;
  writeDiskJson(DISK_FILE, local);

  try {
    const redis = await getReadyRedis();
    if (redis) {
      const m = redis.multi().hset(HASH_KEY, fieldOf(batch), JSON.stringify(batch));
      if (oldField) m.hdel(HASH_KEY, oldField);
      await m.exec();
    }
  } catch (e) {
    console.warn("[Voucher batch-store] Redis write failed, kept in local store:", e);
  }
}
