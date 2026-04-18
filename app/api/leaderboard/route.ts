import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic'; 

interface LeaderboardEntry {
  address: string;
  basename: string | null;
  score: number;
  rank: string;
  boosts: number;
  badges: number;
  weeklyXP: number;
}

// 🔥 We changed the key to start a brand new, empty database!
const DB_KEY = 'base_real_leaderboard_v1';

export async function GET() {
    try {
        const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
        if (!hasKV) return NextResponse.json({ leaderboard: [] });

        // Just fetch the real data. If it's empty, return an empty array.
        const leaderboard = (await kv.get<LeaderboardEntry[]>(DB_KEY)) || [];
        
        return NextResponse.json({ leaderboard });
    } catch (error) {
        console.error("KV GET Error:", error);
        return NextResponse.json({ leaderboard: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const hasKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
        if (!hasKV) return NextResponse.json({ success: false, error: "Missing KV Keys" });

        const entry: LeaderboardEntry = await request.json();
        let leaderboard: LeaderboardEntry[] = (await kv.get<LeaderboardEntry[]>(DB_KEY)) || [];

        const idx = leaderboard.findIndex((e: LeaderboardEntry) => e.address.toLowerCase() === entry.address.toLowerCase());
        
        if (idx >= 0) {
            leaderboard[idx] = entry; // Update existing real user
        } else {
            leaderboard.push(entry); // Add new real user
        }

        // Sort by Highest XP and keep Top 100
        leaderboard.sort((a, b) => b.weeklyXP - a.weeklyXP);
        leaderboard = leaderboard.slice(0, 100);

        await kv.set(DB_KEY, leaderboard);

        return NextResponse.json({ success: true, leaderboard });
    } catch (error) {
        console.error("KV POST Error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
} 