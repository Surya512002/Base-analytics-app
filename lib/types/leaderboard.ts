export interface LeaderboardEntry {
  address: string;
  basename: string | null;
  score: number;
  rank: string;
  boosts: number;
  badges: number;
  weeklyXP: number;
  badgeMintXp?: number;
  totalXP: number;
  weekNumber: number;
  lastSeen?: number;
}

export type LeaderboardPost = Omit<LeaderboardEntry, "totalXP" | "lastSeen">;
