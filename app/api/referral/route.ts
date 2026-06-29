import { NextResponse } from "next/server";
import { Redis } from "ioredis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFERRALS_KEY = "base_referrals_v1";
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

type RefStore = Record<
  string,
  { invites: string[]; referredBy?: string; bonusXp: number }
>;

async function loadStore(redis: Redis): Promise<RefStore> {
  const raw = await redis.get(REFERRALS_KEY);
  return raw ? (JSON.parse(raw) as RefStore) : {};
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.toLowerCase();
  if (!address?.startsWith("0x")) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const redis = createRedis();
  if (!redis) {
    return NextResponse.json({ invites: 0, bonusXp: 0 });
  }

  try {
    await redis.connect();
    const store = await loadStore(redis);
    const entry = store[address];
    return NextResponse.json({
      invites: entry?.invites?.length ?? 0,
      bonusXp: entry?.bonusXp ?? 0,
      referredBy: entry?.referredBy ?? null,
    });
  } catch {
    return NextResponse.json({ invites: 0, bonusXp: 0 });
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
  const referrer = body.referrer?.toLowerCase();

  if (!address?.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!referrer || referrer === address) {
    return NextResponse.json({ bonusXp: 0, referredBy: null });
  }

  const redis = createRedis();
  if (!redis) {
    return NextResponse.json({ bonusXp: JOIN_BONUS_XP, referredBy: referrer });
  }

  try {
    await redis.connect();
    const store = await loadStore(redis);

    if (store[address]?.referredBy) {
      return NextResponse.json({
        bonusXp: store[address].bonusXp ?? 0,
        referredBy: store[address].referredBy,
      });
    }

    if (!store[address]) {
      store[address] = { invites: [], bonusXp: JOIN_BONUS_XP, referredBy: referrer };
    } else {
      store[address].referredBy = referrer;
      store[address].bonusXp = (store[address].bonusXp ?? 0) + JOIN_BONUS_XP;
    }

    if (!store[referrer]) {
      store[referrer] = { invites: [], bonusXp: 0 };
    }
    if (!store[referrer].invites.includes(address)) {
      store[referrer].invites.push(address);
      store[referrer].bonusXp =
        (store[referrer].bonusXp ?? 0) + REFERRER_XP_PER_INVITE;
    }

    await redis.set(REFERRALS_KEY, JSON.stringify(store));

    return NextResponse.json({
      bonusXp: JOIN_BONUS_XP,
      referredBy: referrer,
    });
  } catch (e) {
    console.error("[referral]", e);
    return NextResponse.json({ bonusXp: JOIN_BONUS_XP, referredBy: referrer });
  } finally {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }
}
