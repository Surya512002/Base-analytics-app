import type { Redis } from "ioredis";
import { getReferralCode } from "@/lib/utils/share";

// Per-wallet records instead of two whole-database JSON blobs: every change is one atomic command,
// so two people joining at the same moment can no longer overwrite each other.
const CODES = "ref:v2:codes"; // hash: code -> wallet
const entryKey = (a: string) => `ref:v2:entry:${a}`; // hash: bonusXp (counter), referredBy
const invitesKey = (a: string) => `ref:v2:invites:${a}`; // set of invited wallets
const LEGACY_STORE = "base_referrals_v1";
const LEGACY_INDEX = "base_ref_code_index_v1";
const MIGRATED = "ref:v2:migrated";

export const JOIN_BONUS_XP = 50;
export const REFERRER_XP_PER_INVITE = 25;

export const referralCode = (address: string) => getReferralCode(address).toLowerCase();

const isAddress = (s: string) => s.startsWith("0x") && s.length === 42;

type LegacyEntry = { invites?: string[]; referredBy?: string; bonusXp?: number };

/** One time: copy the two old blobs into the new records. Only the request that wins the flag runs it. */
async function migrateLegacy(redis: Redis): Promise<void> {
  if ((await redis.set(MIGRATED, "1", "NX")) !== "OK") return;
  const [rawStore, rawIndex] = await redis.mget(LEGACY_STORE, LEGACY_INDEX);
  if (!rawStore && !rawIndex) return;
  const store = (rawStore ? JSON.parse(rawStore) : {}) as Record<string, LegacyEntry>;
  const index = (rawIndex ? JSON.parse(rawIndex) : {}) as Record<string, string>;
  const m = redis.multi();
  for (const [code, addr] of Object.entries(index)) if (isAddress(addr)) m.hsetnx(CODES, code, addr);
  for (const [key, e] of Object.entries(store)) {
    // old 8-char code buckets belong to the wallet the index maps that code to
    const addr = isAddress(key) ? key : index[key];
    if (!addr || !isAddress(addr)) continue;
    if (e.bonusXp) m.hincrby(entryKey(addr), "bonusXp", e.bonusXp);
    if (e.referredBy) m.hsetnx(entryKey(addr), "referredBy", e.referredBy);
    if (e.invites?.length) m.sadd(invitesKey(addr), ...e.invites);
    m.hsetnx(CODES, referralCode(addr), addr);
  }
  await m.exec();
  await redis.expire(LEGACY_STORE, 60 * 60 * 24 * 14);
  await redis.expire(LEGACY_INDEX, 60 * 60 * 24 * 14);
}

export async function getReferral(redis: Redis, address: string) {
  await migrateLegacy(redis);
  await redis.hsetnx(CODES, referralCode(address), address);
  const [e, invites] = await Promise.all([redis.hgetall(entryKey(address)), redis.scard(invitesKey(address))]);
  return { invites, bonusXp: Number(e.bonusXp ?? 0), referredBy: e.referredBy ?? null, code: referralCode(address) };
}

/** Record that `address` joined via `referrerInput` (8-char code or 0x wallet). Idempotent per joiner. */
export async function joinReferral(redis: Redis, address: string, referrerInput: string) {
  await migrateLegacy(redis);
  await redis.hsetnx(CODES, referralCode(address), address);

  const input = referrerInput.toLowerCase().trim();
  const referrer = isAddress(input) ? input : await redis.hget(CODES, input);
  if (!referrer || referrer === address) return { bonusXp: 0, referredBy: null as string | null };

  const code = referralCode(referrer);
  await redis.hsetnx(CODES, code, referrer);

  // HSETNX is the gate: only the first join for this wallet pays out.
  if ((await redis.hsetnx(entryKey(address), "referredBy", code)) === 0) {
    const e = await redis.hgetall(entryKey(address));
    return { bonusXp: Number(e.bonusXp ?? 0), referredBy: e.referredBy ?? null };
  }
  await redis.hincrby(entryKey(address), "bonusXp", JOIN_BONUS_XP);
  if ((await redis.sadd(invitesKey(referrer), address)) === 1) {
    await redis.hincrby(entryKey(referrer), "bonusXp", REFERRER_XP_PER_INVITE);
  }
  return { bonusXp: JOIN_BONUS_XP, referredBy: code };
}
