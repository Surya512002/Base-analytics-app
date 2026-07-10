import type { VestingScheduleEntry } from "@/lib/launchpad/launch-config";

export interface TokenAnnouncement {
  id: string;
  body: string;
  createdAt: number;
  creator: string;
}

export type TokenSource = "launched" | "external" | "b20";

export interface LaunchedToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  creator: string;
  txHash: string;
  imageUrl?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  createdAt: number;
  /** App registry launch vs DexScreener / paste-import */
  source?: TokenSource;
  supplyCap?: string;
  launchPreset?: string;
  vestingSchedule?: VestingScheduleEntry[];
  /** Block number of B20 create tx */
  launchBlock?: number;
  /** USD price per whole token at launch — used to size LP seed. */
  startPriceUsd?: string;
  /** Blocks after pool opens where buys are blocked (default 8) */
  antiSnipeBlocks?: number;
  /** First on-chain pool activity block */
  poolOpenBlock?: number;
}

export interface LaunchpadStatus {
  b20Activated: boolean;
  tokenCount: number;
}

export interface SwapQuoteResult {
  amountIn: string;
  amountOut: string;
  priceImpactBps: number;
  hasLiquidity: boolean;
  error?: string;
}

export type SwapDirection = "buy" | "sell";
