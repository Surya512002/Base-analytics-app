"use server";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// FIXED: Pass the key as an object { apiKey: ... }
const client = new NeynarAPIClient({
  apiKey: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || ""
});

export async function fetchUserAnalytics(fid: number) {
  try {
    // 1. Fetch User Profile (Followers, Following, Score)
    const userResponse = await client.fetchBulkUsers({ fids: [fid] });
    const user = userResponse.users[0];

    // Safety check for score (defaults to 0 if null)
    // Note: score is usually a float between 0 and 1
    const neynarScore = user.score || 0; 

    return {
      neynarScore: neynarScore,
      followers: user.follower_count,
      following: user.following_count,
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