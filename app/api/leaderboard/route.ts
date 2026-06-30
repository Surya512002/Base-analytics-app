import { NextResponse } from 'next/server';
import { Redis } from 'ioredis';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

interface LeaderboardEntry {
  address:    string;
  basename:   string | null;
  score:      number;
  rank:       string;
  boosts:     number;
  badges:     number;
  weeklyXP:   number;   // XP earned THIS week (resets Mon) — quests + activity only
  badgeMintXp?: number; // cumulative badge mint XP (season global ranking only)
  totalXP:    number;   // cumulative all-time season XP (NEVER sent by client — always computed here)
  weekNumber: number;   // ISO week when weeklyXP was last set
  lastSeen?:  number;
}

// ONE key for all-time data — never changes across versions
const DB_KEY = 'base_season1_leaderboard';

function createRedis(): Redis {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error('KV_REDIS_URL not set');
  const client = new Redis(url, {
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    lazyConnect: true, maxRetriesPerRequest: 1,
    connectTimeout: 8000, commandTimeout: 5000, enableReadyCheck: false,
  });
  client.on('error', (e) => console.error('[Redis]', e.message));
  return client;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
}

export async function GET() {
  let redis: Redis | null = null;
  try {
    redis = createRedis(); await redis.connect();
    const raw = await redis.get(DB_KEY);
    const leaderboard: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error('[LB GET]', err);
    return NextResponse.json({ leaderboard: [] });
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}

export async function POST(req: Request) {
  let redis: Redis | null = null;
  try {
    redis = createRedis(); await redis.connect();

    // Client sends: address, basename, score, rank, boosts, badges, weeklyXP, badgeMintXp, weekNumber
    // Client NEVER controls totalXP — backend always computes it
    const client: Omit<LeaderboardEntry, 'totalXP'> = await req.json();

    if (!client.address?.startsWith('0x') || client.address.length !== 42) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
    }

    const sanitized = {
      ...client,
      address: client.address.toLowerCase(),
      score: Math.min(100, Math.max(0, Math.round(client.score ?? 0))),
      boosts: Math.min(10_000, Math.max(0, Math.round(client.boosts ?? 0))),
      badges: Math.min(100, Math.max(0, Math.round(client.badges ?? 0))),
      weeklyXP: Math.min(2500, Math.max(0, Math.round(client.weeklyXP ?? 0))),
      badgeMintXp: Math.min(5000, Math.max(0, Math.round(client.badgeMintXp ?? 0))),
      basename: client.basename?.slice(0, 64) ?? null,
      rank: (client.rank ?? 'Base User').slice(0, 48),
    };

    const thisWeek = isoWeek(new Date());
    const now = Date.now();

    const raw = await redis.get(DB_KEY);
    const lb: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];

    const idx = lb.findIndex(e => e.address.toLowerCase() === sanitized.address.toLowerCase());

    const computeTotal = (
      prevTotal: number,
      prevWeekly: number,
      prevBadge: number,
      weekly: number,
      badge: number,
      sameWeek: boolean
    ) => {
      const weeklyHistory = sameWeek
        ? prevTotal - prevWeekly - prevBadge
        : prevTotal - prevBadge;
      return weeklyHistory + weekly + badge;
    };

    if (idx === -1) {
      lb.push({
        ...sanitized,
        totalXP: sanitized.weeklyXP + (sanitized.badgeMintXp ?? 0),
        weekNumber: thisWeek,
        lastSeen: now,
      });
    } else {
      const existing = lb[idx];
      const prevTotal   = existing.totalXP   ?? existing.weeklyXP ?? 0;
      const prevWeekly  = existing.weeklyXP  ?? 0;
      const prevBadge   = existing.badgeMintXp ?? 0;
      const prevWeekNum = existing.weekNumber ?? 0;
      const sameWeek = prevWeekNum === thisWeek;

      const newTotal = computeTotal(
        prevTotal,
        prevWeekly,
        prevBadge,
        sanitized.weeklyXP,
        sanitized.badgeMintXp ?? 0,
        sameWeek
      );

      lb[idx] = {
        ...sanitized,
        totalXP:    newTotal,
        weekNumber: thisWeek,
        lastSeen:   now,
      };
    }

    // Sort by totalXP descending
    lb.sort((a, b) => (b.totalXP ?? 0) - (a.totalXP ?? 0));

    await redis.set(DB_KEY, JSON.stringify(lb));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[LB POST]', err);
    return NextResponse.json({ success: false }, { status: 500 });
  } finally {
    if (redis) try { await redis.quit(); } catch { redis.disconnect(); }
  }
}
