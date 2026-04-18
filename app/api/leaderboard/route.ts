import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// 🔥 THIS DISABLES NEXT.JS CACHING SO THE LEADERBOARD IS ALWAYS LIVE
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

// Generates realistic mock data for the hackathon demo
function generateMockLeaderboard(): LeaderboardEntry[] {
  const ranks = ["Base Shrimp 🦐", "Base Dolphin 🐬", "Base Shark 🦈", "Base Whale 🐋", "Base God 👑"];
  const mock: LeaderboardEntry[] = [];
  const predefinedNames = ["jesse.base.eth", "brian.base.eth", "vitalik.eth", "builder.base.eth", "degen.base.eth", "based.eth", "coinbase.eth"];
  
  for (let i = 1; i <= 99; i++) {
    const isBasename = Math.random() > 0.4;
    const score = Math.floor(Math.random() * 80) + 20; 
    
    let weeklyXP = 0;
    if (i < 10) weeklyXP = Math.floor(Math.random() * 300) + 700;
    else if (i < 40) weeklyXP = Math.floor(Math.random() * 400) + 300;
    else weeklyXP = Math.floor(Math.random() * 250) + 50;
    
    let rank = ranks[0];
    if(score >= 30) rank = ranks[1];
    if(score >= 60) rank = ranks[2];
    if(score >= 75) rank = ranks[3];
    if(score >= 85) rank = ranks[4];

    mock.push({
      address: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
      basename: isBasename ? (i < 8 ? predefinedNames[i-1] : `user${Math.floor(Math.random() * 9999)}.base.eth`) : null,
      score,
      rank,
      boosts: Math.floor(Math.random() * 5),
      badges: Math.floor(Math.random() * 8),
      weeklyXP
    });
  }
  return mock.sort((a, b) => b.weeklyXP - a.weeklyXP);
}

export async function GET() {
    try {
        let leaderboard = await kv.get<LeaderboardEntry[]>('base_global_leaderboard');
        
        // 🔥 If DB is empty, generate the 99 mock users and save them!
        if (!leaderboard || leaderboard.length === 0) {
            leaderboard = generateMockLeaderboard();
            await kv.set('base_global_leaderboard', leaderboard);
        }
        
        return NextResponse.json({ leaderboard });
    } catch (error) {
        console.error("KV GET Error:", error);
        return NextResponse.json({ leaderboard: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const entry: LeaderboardEntry = await request.json();
        let leaderboard: LeaderboardEntry[] = (await kv.get<LeaderboardEntry[]>('base_global_leaderboard')) || [];

        const idx = leaderboard.findIndex((e: LeaderboardEntry) => e.address.toLowerCase() === entry.address.toLowerCase());
        
        if (idx >= 0) {
            leaderboard[idx] = entry; // Update existing
        } else {
            leaderboard.push(entry); // Add new
        }

        // Sort by Highest XP and keep Top 100
        leaderboard.sort((a, b) => b.weeklyXP - a.weeklyXP);
        leaderboard = leaderboard.slice(0, 100);

        await kv.set('base_global_leaderboard', leaderboard);

        return NextResponse.json({ success: true, leaderboard });
    } catch (error) {
        console.error("KV POST Error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
} 