"use server";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// Initialize Client (Server-Side Only for security)
const client = new NeynarAPIClient({
  apiKey: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || ""
});

export async function fetchUserAnalytics(fid: number) {
  try {
    if (!process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID) {
      console.error("CRITICAL: Neynar Client ID is missing in environment variables!");
      return null;
    }

    // 1. Fetch User Profile
    const userResponse = await client.fetchBulkUsers({ fids: [fid] });
    
    if (!userResponse || !userResponse.users || userResponse.users.length === 0) {
      console.error("Neynar API returned no users for FID:", fid);
      return null;
    }

    const user = userResponse.users[0];
    
    // Log the user object to see if score exists (Check Vercel logs)
    // console.log("Fetched User:", JSON.stringify(user, null, 2));

    // 2. Mock Engagement Data (Replace with real data later)
    return {
      neynarScore: user.score || 0, // Fallback to 0 if undefined
      followers: user.follower_count || 0,
      following: user.following_count || 0,
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
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return null;
  }
} 