import type { PredictionAsset, PredictionDuration } from "@/lib/constants/predictions";
import type { PoolState } from "@/lib/predictions/amm";

export type MarketPhase = "open" | "closed" | "resolved" | "void";

export interface LiveMarket {
  trackId: string;
  asset: PredictionAsset;
  duration: PredictionDuration;
  roundId: number;
  phase: MarketPhase;
  openTime: number;
  closeTime: number;
  resolveTime: number;
  openPrice: number;
  currentPrice: number;
  resolvePrice: number | null;
  pool: PoolState;
  yesWins: boolean | null;
  totalVolumeUsdc: number;
  participants: number;
  oneSided: boolean;
}

export interface UserPosition {
  trackId: string;
  roundId: number;
  yesShares: number;
  noShares: number;
}

export interface PricePoint {
  t: number;
  price: number;
}

export interface CandlePoint {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StreakEntry {
  address: string;
  basename: string | null;
  wins: number;
  streak: number;
}
