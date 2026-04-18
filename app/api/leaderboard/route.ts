import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// 1. Define the exact shape of our data so TypeScript is happy
interface LeaderboardEntry {
  address: string;
  basename: string | null;
  score: number;
  rank: string;
  boosts: number;
  badges: number;
  weeklyXP: number;
}

export async function GET() {
    try {
        // Fetch the global array and cast it strictly as our interface
        const leaderboard = await kv.get<LeaderboardEntry[]>('base_global_leaderboard') || [];
        return NextResponse.json({ leaderboard });
    } catch (error) {
        console.error("KV GET Error:", error);
        return NextResponse.json({ leaderboard: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const entry: LeaderboardEntry = await request.json();
        
        // 1. Get the current global leaderboard with strict typing
        let leaderboard: LeaderboardEntry[] = (await kv.get<LeaderboardEntry[]>('base_global_leaderboard')) || [];

        // 2. Check if the user is already on the board (No more 'any' here!)
        const idx = leaderboard.findIndex((e: LeaderboardEntry) => e.address.toLowerCase() === entry.address.toLowerCase());
        
        if (idx >= 0) {
            // Update existing user
            leaderboard[idx] = entry;
        } else {
            // Add new user
            leaderboard.push(entry);
        }

        // 3. Sort by Highest XP and keep only the Top 100
        leaderboard.sort((a, b) => b.weeklyXP - a.weeklyXP);
        leaderboard = leaderboard.slice(0, 100);

        // 4. Save it back to the database
        await kv.set('base_global_leaderboard', leaderboard);

        return NextResponse.json({ success: true, leaderboard });
    } catch (error) {
        console.error("KV POST Error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
} 