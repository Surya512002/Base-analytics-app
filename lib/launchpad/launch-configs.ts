import type { LaunchTokenType } from "@/lib/launchpad/types";

export interface LockDurationOption {
  days: number;
  label: string;
}

export const LOCK_DURATION_OPTIONS: readonly LockDurationOption[] = [
  { days: 30, label: "30 Days" },
  { days: 90, label: "90 Days" },
  { days: 180, label: "180 Days" },
  { days: 365, label: "1 Year" },
] as const;

export const DEFAULT_LOCK_DURATION_DAYS = 365;

export const VENUE_OPTIONS = [
  { id: "aerodrome", name: "Aerodrome", desc: "Native Base ve(3,3) DEX with low fees & deep slips" },
  { id: "uniswap", name: "Uniswap V3", desc: "Concentrated liquidity pool on Base mainnet" },
  { id: "both", name: "Both (50 / 50)", desc: "Split liquidity evenly across Aerodrome and Uniswap V3" },
] as const;

export type LaunchVenueId = (typeof VENUE_OPTIONS)[number]["id"];

export const MAX_INSIDERS = 8;
export const MAX_VESTED = 6;
export const DEFAULT_ANTI_SNIPE_BLOCKS = 8;
export const MAX_ANTI_SNIPE_BLOCKS = 24;

export const DEFAULT_STARTING_PRICE_USD = "0.000003918";

/** Helper to format starting price in readable format without subscript notation */
export function formatReadablePrice(priceStr: string): string {
  const num = parseFloat(priceStr);
  if (!Number.isFinite(num) || num <= 0) return "$0.00";
  if (num >= 1) return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  // For small micro-prices, print directly up to 9 decimal places
  return `$${num.toFixed(9).replace(/0+$/, "")}`;
}

/** Check if US equity markets / Chainlink 24/5 feeds are currently active */
export function isUSMarketOpenNow(): boolean {
  try {
    const now = new Date();
    // Format to US Eastern Time (ET)
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const day = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

    const isWeekend = day === "Sat" || day === "Sun";
    if (isWeekend) return false;

    // Standard market hours: 9:30 AM to 4:00 PM ET
    const totalMinutes = hour * 60 + minute;
    return totalMinutes >= 9 * 60 + 30 && totalMinutes <= 16 * 60;
  } catch {
    return true; // Fallback to open
  }
}

/** Local storage draft key */
export const LAUNCH_DRAFT_STORAGE_KEY = "base_launch_form_draft_v2";

export interface LaunchDraftData {
  step: number;
  launchType: LaunchTokenType;
  selectedStockSymbol: string;
  name: string;
  symbol: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  creatorPct: number;
  insiders: Array<{ id: string; address: string; pct: number }>;
  vested: Array<{ id: string; address: string; pct: number; cliffMonths: number; vestMonths: number }>;
  autoSeedLiquidity: boolean;
  seedLiquidityEth: string;
  seedDex: LaunchVenueId;
  liquidityLocked: boolean;
  lockDurationDays: number;
  antiSnipeBlocks: number;
  metadataEditable: boolean;
  startPriceUsd: string;
}

export function saveLaunchDraft(data: LaunchDraftData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAUNCH_DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore storage quota */
  }
}

export function loadLaunchDraft(): LaunchDraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAUNCH_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLaunchDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAUNCH_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
