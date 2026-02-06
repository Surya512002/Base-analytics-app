"use server";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

const config = new Configuration({
  apiKey: process.env.NEXT_PUBLIC_NEYNAR_API_KEY || "",
});

const client = new NeynarAPIClient(config);

interface FarcasterCast {
  timestamp: string;
  replies: { count: number };
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
}

interface NeynarUser {
  follower_count: number;
  neynar_user_score?: number;
  score?: number;
}

export async function fetchUserAnalytics(fid: number) {
  if (!fid) return null;
  try {
    const userResponse = await client.fetchBulkUsers({ fids: [fid] });
    const userProfile = userResponse.users[0] as unknown as NeynarUser;

    const castResponse = await client.fetchCastsForUser({ fid, limit: 150 });
    const casts = (castResponse.casts || []) as unknown as FarcasterCast[];
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const stats = {
      day: { likes: 0, recasts: 0, replies: 0, posts: 0 },
      week: { likes: 0, recasts: 0, replies: 0, posts: 0 },
      twoWeeks: { likes: 0, recasts: 0, replies: 0, posts: 0 },
    };

    casts.forEach((cast) => {
      const diff = now - new Date(cast.timestamp).getTime();
      
      const addStats = (bucket: 'day' | 'week' | 'twoWeeks') => {
        stats[bucket].likes += cast.reactions.likes_count || 0;
        stats[bucket].recasts += cast.reactions.recasts_count || 0;
        stats[bucket].replies += cast.replies?.count || 0;
        stats[bucket].posts += 1;
      };

      if (diff < oneDay * 14) addStats('twoWeeks');
      if (diff < oneDay * 7) addStats('week');
      if (diff < oneDay) addStats('day');
    });

    return { 
      ...stats, 
      neynarScore: userProfile.neynar_user_score ?? userProfile.score ?? 0 
    };
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
}