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
  weeklyXP:   number;   // XP earned THIS week (resets Mon)
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

    // Client sends: address, basename, score, rank, boosts, badges, weeklyXP, weekNumber
    // Client NEVER controls totalXP — backend always computes it
    const client: Omit<LeaderboardEntry, 'totalXP'> = await req.json();

    if (!client.address?.startsWith('0x')) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
    }

    const thisWeek = isoWeek(new Date());
    const now = Date.now();

    const raw = await redis.get(DB_KEY);
    const lb: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];

    const idx = lb.findIndex(e => e.address.toLowerCase() === client.address.toLowerCase());

    if (idx === -1) {
      // ── Brand new user: totalXP = weeklyXP from first week ─────────────────
      lb.push({
        ...client,
        totalXP: client.weeklyXP,
        weekNumber: thisWeek,
        lastSeen: now,
      });
    } else {
      const existing = lb[idx];
      const prevTotal   = existing.totalXP   ?? existing.weeklyXP ?? 0;
      const prevWeekly  = existing.weeklyXP  ?? 0;
      const prevWeekNum = existing.weekNumber ?? 0;

      let newTotal: number;

      if (prevWeekNum !== thisWeek) {
        // ── Week rolled over: old weeklyXP is now "locked" into history ────────
        // totalXP = everything before this week + new week's XP
        // We keep prevTotal (which already includes all previous weeks' XP locked)
        // and just add the new weeklyXP on top.
        // BUT if the user is visiting for the first time this week, prevTotal
        // already contains last week's contribution, so:
        newTotal = prevTotal + client.weeklyXP;
      } else {
        // ── Same week: totalXP = (total minus last recorded weekly) + new weekly
        // This handles the user earning more XP within the same week
        const lockedHistory = prevTotal - prevWeekly; // XP from all weeks BEFORE this one
        newTotal = lockedHistory + client.weeklyXP;
      }

      lb[idx] = {
        ...client,
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
