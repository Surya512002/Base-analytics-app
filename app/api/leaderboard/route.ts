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
  weeklyXP: number;
  lastSeen?: number;
}

const DB_KEY = 'base_leaderboard_v2';

function createRedisClient(): Redis {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error('KV_REDIS_URL environment variable is not set');

  // Handle both redis:// and rediss:// (TLS)
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
    // Suppress connection errors from crashing the server
    console.error('[Redis] Connection error:', err.message);
  });

  return client;
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
    // Return empty array gracefully — don't crash the app
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

    const entry: LeaderboardEntry = await request.json();

    // Validate entry
    if (!entry.address || !entry.address.startsWith('0x')) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
    }

    entry.lastSeen = Date.now();

    const raw = await redis.get(DB_KEY);
    const leaderboard: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];

    const idx = leaderboard.findIndex(
      (e) => e.address.toLowerCase() === entry.address.toLowerCase()
    );

    if (idx >= 0) {
      leaderboard[idx] = entry;
    } else {
      leaderboard.push(entry);
    }

    // Sort by weeklyXP descending, keep top 200
    leaderboard.sort((a, b) => b.weeklyXP - a.weeklyXP);
    // No cap — store all participants for Genesis Season count

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