/**
 * Server storage for private vaults. The server never sees inside: an envelope is encrypted in
 * the creator's browser (vault-crypto.ts). We only keep it, version it, and hand it back to the
 * signed-in creator.
 */
import { getRedisClient, ensureRedisReady } from "@/lib/redis-cache";
import { readDiskJson, writeDiskJson } from "@/lib/utils/disk-store";
import type { VaultEnvelope } from "@/lib/voucher/vault-crypto";

export interface StoredVault {
  envelope: VaultEnvelope;
  /** Bumped on every write; writers must send the version they read (stops two devices clobbering). */
  version: number;
  updatedAt: number;
}

/** Hard cap on one creator's envelope (≈ thousands of batches); stops storage abuse. */
export const MAX_VAULT_BYTES = 512 * 1024;

const vaultKey = (creator: string) => `base_voucher_vault_${creator.toLowerCase()}`;
const DISK_FILE = "voucher-vaults.json";
const memory = new Map<string, StoredVault | null>();

export async function readVault(creator: string): Promise<StoredVault | null> {
  const c = creator.toLowerCase();
  try {
    const redis = getRedisClient();
    if (redis) {
      await ensureRedisReady(redis);
      const raw = await redis.get(vaultKey(c));
      const parsed = raw ? (JSON.parse(raw) as StoredVault) : null;
      memory.set(c, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("[voucher vault] Redis read failed, using local store:", err);
  }
  if (memory.has(c)) return memory.get(c) ?? null;
  const fromDisk = readDiskJson<Record<string, StoredVault>>(DISK_FILE, {})[c] ?? null;
  memory.set(c, fromDisk);
  return fromDisk;
}

async function write(creator: string, value: StoredVault | null): Promise<void> {
  const c = creator.toLowerCase();
  memory.set(c, value);
  const all = readDiskJson<Record<string, StoredVault>>(DISK_FILE, {});
  if (value) all[c] = value;
  else delete all[c];
  writeDiskJson(DISK_FILE, all);
  const redis = getRedisClient();
  if (!redis) return;
  await ensureRedisReady(redis);
  if (value) await redis.set(vaultKey(c), JSON.stringify(value));
  else await redis.del(vaultKey(c));
}

export type WriteVaultResult =
  | { ok: true; vault: StoredVault }
  | { ok: false; conflict: true; current: StoredVault | null };

/**
 * Save an envelope if `baseVersion` matches what's stored (0 = no vault yet).
 * Not atomic across processes, but a lost race only costs a retry: the client re-reads,
 * merges and writes again.
 */
export async function writeVault(
  creator: string,
  envelope: VaultEnvelope,
  baseVersion: number
): Promise<WriteVaultResult> {
  const current = await readVault(creator);
  const currentVersion = current?.version ?? 0;
  if (currentVersion !== baseVersion) return { ok: false, conflict: true, current };
  const next: StoredVault = { envelope, version: currentVersion + 1, updatedAt: Date.now() };
  await write(creator, next);
  return { ok: true, vault: next };
}

export async function deleteVault(creator: string): Promise<void> {
  await write(creator, null);
}
