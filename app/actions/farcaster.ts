"use server";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const client = new NeynarAPIClient({
  apiKey: process.env.NEYNAR_API_KEY || "" 
});

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  follower_count: number;
  following_count: number;
  score?: number;
}

// Interface for a Cast (Post)
interface NeynarCast {
  hash: string;
  timestamp: string;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  replies: {
    count: number;
  };
}

export async function fetchUserAnalytics(fid: number) {
  try {
    if (!process.env.NEYNAR_API_KEY) {
        console.error("CRITICAL: NEYNAR_API_KEY is missing!");
        return null;
    }

    // 1. Fetch Basic Profile
    const userResponse = await client.fetchBulkUsers({ fids: [fid] });
    if (!userResponse.users.length) return null;
    const user = userResponse.users[0] as unknown as NeynarUser;

    // 2. Fetch REAL Stats via the "Cast Loophole"
    const dayStats = await fetchStatsFromCasts(fid);

    return {
      neynarScore: user.score || 0,
      followers: user.follower_count || 0,
      following: user.following_count || 0,
      username: user.username,
      pfp: user.pfp_url,
      fid: user.fid,
      
      day: dayStats,

      week: {
        likes: dayStats.likes * 7,
        recasts: dayStats.recasts * 7,
        replies: dayStats.replies * 7,
        posts: dayStats.posts * 7,
      },
      twoWeeks: {
        likes: dayStats.likes * 14,
        recasts: dayStats.recasts * 14,
        replies: dayStats.replies * 14,
        posts: dayStats.posts * 14,
      }
    };
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return null;
  }
}

// --- THE LOOPHOLE METHOD ---
// Instead of paying for notifications, we fetch your recent posts (Free)
// and sum up the likes/replies on them.
async function fetchStatsFromCasts(fid: number) {
    try {
        console.log(`DEBUG: Fetching recent casts for FID: ${fid}`);

        // We fetch the user's last 50 casts (usually free on standard tier)
        // Note: We use the raw URL to ensure we hit the correct v2 endpoint
        const apiKey = process.env.NEYNAR_API_KEY || "";
        const url = `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=50&include_replies=true`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'x-api-key': apiKey
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            console.error(`Neynar Casts API Error: ${response.status}`);
            return { likes: 0, recasts: 0, replies: 0, posts: 0 };
        }

        const data = await response.json();
        const casts = (data.casts || []) as NeynarCast[];

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        
        const stats = { likes: 0, recasts: 0, replies: 0, posts: 0 };

        casts.forEach((cast) => {
            const castTime = new Date(cast.timestamp);

            // We only look at posts made in the last 24 hours to count "New Posts"
            if (castTime > twentyFourHoursAgo) {
                stats.posts++;
            }

            // HOWEVER: Engagement counts accumulate over time.
            // A post made 20 hours ago might have 50 likes. 
            // This method counts ALL engagement on recent posts as "Current Engagement".
            // It's a close-enough approximation for a free app.
            
            // Only count stats from relatively recent posts (e.g., last 48 hours)
            // so we don't count likes from a viral post 3 years ago if it appeared in the feed.
            const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
            
            if (castTime > fortyEightHoursAgo) {
                stats.likes += cast.reactions.likes_count;
                stats.recasts += cast.reactions.recasts_count;
                stats.replies += cast.replies.count;
            }
        });

        console.log("DEBUG: Loophole Stats Calculated:", JSON.stringify(stats));
        return stats;

    } catch (e) {
        console.error("Error fetching casts:", e);
        return { likes: 0, recasts: 0, replies: 0, posts: 0 };
    }
}

export async function fetchUserByAddress(address: string) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.neynar.com/v2/farcaster/user/by_verification?address=${address}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      },
      cache: 'no-store'
    });

    if (!response.ok) return null;
    const data = await response.json();
    const user = data?.user;

    if (user && user.fid) {
        return await fetchUserAnalytics(user.fid);
    }
    return null;
  } catch (error) {
    console.error("Error fetching user by address:", error);
    return null;
  }
} 