import type {
  LeaderboardEntry,
  LeaderboardPost,
} from "@/lib/types/leaderboard";

export async function saveLeaderboard(entry: LeaderboardPost): Promise<void> {
  try {
    await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const r = await fetch("/api/leaderboard");
    if (!r.ok) return [];
    const d = await r.json();
    return d.leaderboard || [];
  } catch {
    return [];
  }
}
