export const FIXED_LAUNCH_SUPPLY = "1000000000";
export const FIXED_LAUNCH_SUPPLY_LABEL = "1B";

export type QuoteToken = "ETH" | "USDC";

export interface InsiderAllocation {
  id: string;
  address: string;
  /** Percent of total 1B supply (0–100) */
  pct: number;
}

/** Vested team allocation — tokens stay unminted until on-chain vault (recorded in registry). */
export interface VestedAllocation {
  id: string;
  address: string;
  pct: number;
  cliffMonths: number;
  vestMonths: number;
}

export interface VestingScheduleEntry {
  address: string;
  pct: number;
  cliffMonths: number;
  vestMonths: number;
}

export interface LaunchFormConfig {
  name: string;
  symbol: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  quoteToken: QuoteToken;
  /** USD price per whole token at launch */
  startPriceUsd: string;
  metadataEditable: boolean;
  creatorPct: number;
  insiderAllocations: InsiderAllocation[];
  vestedAllocations?: VestedAllocation[];
  vanitySalt: `0x${string}` | null;
  vanityAttempts: number;
}

export function poolSeedPct(config: {
  creatorPct: number;
  insiderAllocations: InsiderAllocation[];
  vestedAllocations?: VestedAllocation[];
}): number {
  const insider = config.insiderAllocations.reduce((s, a) => s + (a.pct || 0), 0);
  const vested = (config.vestedAllocations ?? []).reduce((s, a) => s + (a.pct || 0), 0);
  return Math.max(0, 100 - config.creatorPct - insider - vested);
}

export function totalMintedPct(config: {
  creatorPct: number;
  insiderAllocations: InsiderAllocation[];
}): number {
  return config.creatorPct + config.insiderAllocations.reduce((s, a) => s + (a.pct || 0), 0);
}

export function totalVestedPct(vestedAllocations: VestedAllocation[]): number {
  return vestedAllocations.reduce((s, a) => s + (a.pct || 0), 0);
}

export function totalAllocatedPct(config: {
  creatorPct: number;
  insiderAllocations: InsiderAllocation[];
  vestedAllocations?: VestedAllocation[];
}): number {
  return (
    totalMintedPct(config) + totalVestedPct(config.vestedAllocations ?? [])
  );
}
