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

function getRedis() {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error('KV_REDIS_URL not set');
  return new Redis(url, { tls: url.startsWith('rediss://') ? {} : undefined, lazyConnect: true, maxRetriesPerRequest: 2, connectTimeout: 5000 });
}

const DB_KEY = 'base_leaderboard_v2';

export async function GET() {
  let redis: Redis | null = null;
  try {
    redis = getRedis();
    await redis.connect();
    const raw = await redis.get(DB_KEY);
    const leaderboard: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Redis GET Error:', error);
    return NextResponse.json({ leaderboard: [] });
  } finally {
    if (redis) await redis.quit().catch(() => {});
  }
}

export async function POST(request: Request) {
  let redis: Redis | null = null;
  try {
    redis = getRedis();
    await redis.connect();
    const entry: LeaderboardEntry = await request.json();
    entry.lastSeen = Date.now();
    
    const raw = await redis.get(DB_KEY);
    let leaderboard: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    
    const idx = leaderboard.findIndex(e => e.address.toLowerCase() === entry.address.toLowerCase());
    if (idx >= 0) { leaderboard[idx] = entry; } else { leaderboard.push(entry); }
    
    leaderboard.sort((a, b) => b.weeklyXP - a.weeklyXP);
    leaderboard = leaderboard.slice(0, 200);
    
    await redis.set(DB_KEY, JSON.stringify(leaderboard));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Redis POST Error:', error);
    return NextResponse.json({ success: false });
  } finally {
    if (redis) await redis.quit().catch(() => {});
  }
}
 