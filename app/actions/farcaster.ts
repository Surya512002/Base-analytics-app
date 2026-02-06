"use server";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// Initialize Client for server-side calls
const client = new NeynarAPIClient({
  apiKey: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || ""
});

// Define types to fix "Unexpected any" errors
interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  follower_count: number;
  following_count: number;
  score?: number;
}

export async function fetchUserAnalytics(fid: number) {
  try {
    if (!process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID) return null;

    const userResponse = await client.fetchBulkUsers({ fids: [fid] });
    
    // Fix: Explicitly cast the response to avoid type errors
    if (!userResponse || !userResponse.users || userResponse.users.length === 0) return null;
    
    // We force the type here to satisfy TypeScript
    const user = userResponse.users[0] as unknown as NeynarUser;
    
    return generateMockStats(user);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return null;
  }
}

export async function fetchUserByAddress(address: string) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID;
    if (!apiKey) {
        console.error("Missing Neynar API Key");
        return null;
    }

    // USE RAW FETCH to avoid SDK version mismatches
    // Fix: Using 'x-api-key' header which is required for direct API calls
    const url = `https://api.neynar.com/v2/farcaster/user/by_verification?address=${address}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey // <--- FIXED: Was 'api_key'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
        console.error("Neynar API Error:", response.status, response.statusText);
        return null;
    }

    const data = await response.json();
    const user = data?.user as NeynarUser; // Fix: Typed casting

    if (user) {
        return generateMockStats(user);
    }
    return null;

  } catch (error) {
    console.error("Error fetching user by address:", error);
    return null;
  }
}

// Helper function with proper types
function generateMockStats(user: NeynarUser) {
    return {
      neynarScore: user.score || 0,
      followers: user.follower_count || 0,
      following: user.following_count || 0,
      username: user.username,
      pfp: user.pfp_url,
      fid: user.fid,
      day: {
        likes: Math.floor(Math.random() * 50) + 10,
        recasts: Math.floor(Math.random() * 20) + 5,
        replies: Math.floor(Math.random() * 30) + 5,
        posts: Math.floor(Math.random() * 5) + 1,
      },
      week: {
        likes: Math.floor(Math.random() * 300) + 50,
        recasts: Math.floor(Math.random() * 100) + 20,
        replies: Math.floor(Math.random() * 150) + 30,
        posts: Math.floor(Math.random() * 20) + 5,
      },
      twoWeeks: {
        likes: Math.floor(Math.random() * 600) + 100,
        recasts: Math.floor(Math.random() * 200) + 50,
        replies: Math.floor(Math.random() * 300) + 60,
        posts: Math.floor(Math.random() * 40) + 10,
      }
    };
} 