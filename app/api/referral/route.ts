import { NextResponse } from "next/server";
import { Redis } from "ioredis";
import { getReferralCode } from "@/lib/utils/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFERRALS_KEY = "base_referrals_v1";
const REF_CODE_INDEX_KEY = "base_ref_code_index_v1";
const JOIN_BONUS_XP = 50;
const REFERRER_XP_PER_INVITE = 25;

function createRedis(): Redis | null {
  const url = process.env.KV_REDIS_URL;
  if (!url) return null;
  return new Redis(url, {
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    commandTimeout: 5000,
    enableReadyCheck: false,
  });
}

type RefEntry = {
  invites: string[];
  referredBy?: string;
  bonusXp: number;
};

type RefStore = Record<string, RefEntry>;
type CodeIndex = Record<string, string>;

function referralCode(address: string): string {
  return getReferralCode(address).toLowerCase();
}

function isSelfReferral(address: string, referrerCode: string): boolean {
  const code = referrerCode.toLowerCase();
  if (referralCode(address) === code) return true;
  if (code.startsWith("0x") && code.length === 42 && code === address) return true;
  return false;
}

async function loadStore(redis: Redis): Promise<RefStore> {
  const raw = await redis.get(REFERRALS_KEY);
  return raw ? (JSON.parse(raw) as RefStore) : {};
}

async function loadCodeIndex(redis: Redis): Promise<CodeIndex> {
  const raw = await redis.get(REF_CODE_INDEX_KEY);
  return raw ? (JSON.parse(raw) as CodeIndex) : {};
}

function ensureEntry(store: RefStore, address: string): RefEntry {
  if (!store[address]) {
    store[address] = { invites: [], bonusXp: 0 };
  }
  return store[address];
}

/** Merge legacy 8-char code buckets into full-address entries. */
function migrateLegacyReferrerBucket(store: RefStore, address: string): void {
  const code = referralCode(address);
  const legacy = store[code];
  if (!legacy || code === address) return;
  const entry = ensureEntry(store, address);
  for (const invite of legacy.invites ?? []) {
    if (!entry.invites.includes(invite)) entry.invites.push(invite);
  }
  entry.bonusXp = Math.max(entry.bonusXp, legacy.bonusXp ?? 0);
  delete store[code];
}

async function registerReferrerCode(
  redis: Redis,
  store: RefStore,
  address: string
): Promise<void> {
  const code = referralCode(address);
  const index = await loadCodeIndex(redis);
  if (!index[code]) {
    index[code] = address;
    await redis.set(REF_CODE_INDEX_KEY, JSON.stringify(index));
  }
  migrateLegacyReferrerBucket(store, address);
}

/**
 * Resolve a referral code or full address to a referrer wallet.
 * Accepts 8-char codes and 0x addresses; scans store if index is cold.
 */
function resolveReferrerAddress(
  referrerInput: string,
  codeIndex: CodeIndex,
  store: RefStore
): string | null {
  const input = referrerInput.toLowerCase().trim();

  if (input.startsWith("0x") && input.length === 42) {
    return input;
  }

  if (codeIndex[input]) return codeIndex[input];

  // Cold index: scan known addresses / legacy buckets
  for (const [key, entry] of Object.entries(store)) {
    if (key.startsWith("0x") && key.length === 42 && referralCode(key) === input) {
      return key;
    }
    // Legacy: store keyed by code itself
    if (key === input && entry) {
      // Prefer an invite that points elsewhere? Legacy bucket is the code itself —
      // can't recover address from code-only bucket without index.
      continue;
    }
  }

  for (const [code, addr] of Object.entries(codeIndex)) {
    if (code === input && addr?.startsWith("0x")) return addr;
  }

  return null;
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.toLowerCase();
  if (!address?.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const redis = createRedis();
  if (!redis) {
    return NextResponse.json({ invites: 0, bonusXp: 0, referredBy: null });
  }

  try {
    await redis.connect();
    const store = await loadStore(redis);
    await registerReferrerCode(redis, store, address);
    const entry = ensureEntry(store, address);
    await redis.set(REFERRALS_KEY, JSON.stringify(store));
    return NextResponse.json({
      invites: entry.invites.length,
      bonusXp: entry.bonusXp,
      referredBy: entry.referredBy ?? null,
      code: referralCode(address),
    });
  } catch {
    return NextResponse.json({ invites: 0, bonusXp: 0, referredBy: null });
  } finally {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { address?: string; referrer?: string };
  const address = body.address?.toLowerCase();
  const referrerCode = body.referrer?.toLowerCase().trim();

  if (!address?.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!referrerCode || isSelfReferral(address, referrerCode)) {
    return NextResponse.json({ bonusXp: 0, referredBy: null });
  }

  const redis = createRedis();
  if (!redis) {
    return NextResponse.json({ bonusXp: 0, referredBy: null });
  }

  try {
    await redis.connect();
    const store = await loadStore(redis);
    let codeIndex = await loadCodeIndex(redis);

    await registerReferrerCode(redis, store, address);

    const existing = store[address];
    if (existing?.referredBy) {
      return NextResponse.json({
        bonusXp: existing.bonusXp ?? 0,
        referredBy: existing.referredBy,
      });
    }

    let referrerAddress = resolveReferrerAddress(referrerCode, codeIndex, store);
    if (!referrerAddress || referrerAddress === address) {
      return NextResponse.json({ bonusXp: 0, referredBy: null });
    }

    // Keep index warm for 8-char codes
    const code = referralCode(referrerAddress);
    if (!codeIndex[code]) {
      codeIndex = { ...codeIndex, [code]: referrerAddress };
      await redis.set(REF_CODE_INDEX_KEY, JSON.stringify(codeIndex));
    }

    const joiner = ensureEntry(store, address);
    joiner.referredBy = code;
    joiner.bonusXp = (joiner.bonusXp ?? 0) + JOIN_BONUS_XP;

    const referrer = ensureEntry(store, referrerAddress);
    if (!referrer.invites.includes(address)) {
      referrer.invites.push(address);
      referrer.bonusXp = (referrer.bonusXp ?? 0) + REFERRER_XP_PER_INVITE;
    }

    await redis.set(REFERRALS_KEY, JSON.stringify(store));

    return NextResponse.json({
      bonusXp: JOIN_BONUS_XP,
      referredBy: code,
    });
  } catch (e) {
    console.error("[referral]", e);
    return NextResponse.json({ bonusXp: 0, referredBy: null });
  } finally {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }
}
