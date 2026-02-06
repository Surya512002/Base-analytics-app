"use server";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// --- FIXED: Use the API KEY for data fetching ---
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

export async function fetchUserAnalytics(fid: number) {
  try {
    // Check if API Key is missing
    if (!process.env.NEYNAR_API_KEY) {
        console.error("CRITICAL: NEYNAR_API_KEY is missing in Vercel!");
        return null;
    }

    const userResponse = await client.fetchBulkUsers({ fids: [fid] });
    
    if (!userResponse || !userResponse.users || userResponse.users.length === 0) return null;
    
    const user = userResponse.users[0] as unknown as NeynarUser;
    
    return generateMockStats(user);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return null;
  }
}

export async function fetchUserByAddress(address: string) {
  try {
    // --- FIXED: Use API KEY for the header ---
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
        console.error("Missing NEYNAR_API_KEY");
        return null;
    }

    const url = `https://api.neynar.com/v2/farcaster/user/by_verification?address=${address}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey // Must be the API Key, not Client ID
      },
      cache: 'no-store'
    });

    if (!response.ok) {
        console.error("Neynar API Error:", response.status, response.statusText);
        return null;
    }

    const data = await response.json();
    const user = data?.user as NeynarUser;

    if (user) {
        return generateMockStats(user);
    }
    return null;

  } catch (error) {
    console.error("Error fetching user by address:", error);
    return null;
  }
}

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