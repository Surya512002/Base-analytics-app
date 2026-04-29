import { NextResponse } from 'next/server';
import { Redis } from 'ioredis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface LeaderboardEntry {
  address: string;
  basename: string | null;
  score: number;
  rank: string;
  boosts: number;
  badges: number;
  // weeklyXP  = XP earned THIS week only (resets each Monday)
  weeklyXP: number;
  // totalXP   = cumulative XP across all weeks (never resets until season ends)
  totalXP: number;
  // weekNumber = ISO week number when weeklyXP was last updated
  weekNumber: number;
  lastSeen?: number;
}

const DB_KEY = 'base_leaderboard_v3'; // v3 to avoid conflicts with old data

function createRedisClient(): Redis {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error('KV_REDIS_URL environment variable is not set');
  const isTLS = url.startsWith('rediss://');
  const client = new Redis(url, {
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    commandTimeout: 5000,
    enableReadyCheck: false,
  });
  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });
  return client;
}

// Returns ISO week number (Monday-based) for a given date
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function GET() {
  let redis: Redis | null = null;
  try {
    redis = createRedisClient();
    await redis.connect();
    const raw = await redis.get(DB_KEY);
    const leaderboard: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('[Leaderboard GET] Error:', error);
    return NextResponse.json({ leaderboard: [] });
  } finally {
    if (redis) {
      try { await redis.quit(); } catch { redis.disconnect(); }
    }
  }
}

export async function POST(request: Request) {
  let redis: Redis | null = null;
  try {
    redis = createRedisClient();
    await redis.connect();

    const incoming: LeaderboardEntry = await request.json();

    if (!incoming.address || !incoming.address.startsWith('0x')) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
    }

    const currentWeek = getISOWeekNumber(new Date());
    incoming.lastSeen = Date.now();

    const raw = await redis.get(DB_KEY);
    const leaderboard: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];

    const idx = leaderboard.findIndex(
      (e) => e.address.toLowerCase() === incoming.address.toLowerCase()
    );

    if (idx >= 0) {
      const existing = leaderboard[idx];

      if (existing.weekNumber !== currentWeek) {
        // ── NEW WEEK: carry last week's XP into totalXP, reset weeklyXP ──────
        // totalXP = all previous weeks accumulated + last week's XP
        const accumulatedTotal = (existing.totalXP ?? existing.weeklyXP ?? 0);
        leaderboard[idx] = {
          ...incoming,
          totalXP: accumulatedTotal + incoming.weeklyXP, // add this week on top
          weeklyXP: incoming.weeklyXP,                   // fresh weekly counter
          weekNumber: currentWeek,
        };
      } else {
        // ── SAME WEEK: just update weeklyXP, keep totalXP growing ────────────
        const previousTotal = existing.totalXP ?? existing.weeklyXP ?? 0;
        const previousWeekly = existing.weeklyXP ?? 0;
        // totalXP = all old weeks + current week's XP
        const oldWeeksTotal = previousTotal - previousWeekly;
        leaderboard[idx] = {
          ...incoming,
          totalXP: oldWeeksTotal + incoming.weeklyXP,
          weeklyXP: incoming.weeklyXP,
          weekNumber: currentWeek,
        };
      }
    } else {
      // ── NEW USER ────────────────────────────────────────────────────────────
      leaderboard.push({
        ...incoming,
        totalXP: incoming.weeklyXP,
        weekNumber: currentWeek,
      });
    }

    // Sort by totalXP descending (season leaderboard ranks by cumulative score)
    leaderboard.sort((a, b) => (b.totalXP ?? b.weeklyXP) - (a.totalXP ?? a.weeklyXP));

    await redis.set(DB_KEY, JSON.stringify(leaderboard));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Leaderboard POST] Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  } finally {
    if (redis) {
      try { await redis.quit(); } catch { redis.disconnect(); }
    }
  }
}