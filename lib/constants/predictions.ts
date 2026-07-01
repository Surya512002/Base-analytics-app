import { APP_TREASURY } from "@/lib/constants/treasury";

export { APP_TREASURY };

/** Disclosed protocol fee taken from pool on settlement (basis points). */
export const PROTOCOL_FEE_BPS = 150; // 1.5%

export const PROTOCOL_FEE_LABEL = "1.5%";

export type PredictionAsset = "BTC" | "ETH" | "SOL";

export type PredictionDuration = "1h" | "4h" | "1d";

export interface MarketTrack {
  id: string;
  asset: PredictionAsset;
  duration: PredictionDuration;
  durationSeconds: number;
  /** Chainlink AggregatorV3 on Base (SOL uses ETH-proxy or custom feed). */
  chainlinkFeed: `0x${string}`;
  coingeckoId: string;
}

/** Nine concurrent tracks: BTC / ETH / SOL × 1h / 4h / 1d */
export const MARKET_TRACKS: MarketTrack[] = [
  {
    id: "btc-1h",
    asset: "BTC",
    duration: "1h",
    durationSeconds: 3600,
    chainlinkFeed: "0x64c911996D3E4C1C4249AD8fed065adBfF64B5C6",
    coingeckoId: "bitcoin",
  },
  {
    id: "btc-4h",
    asset: "BTC",
    duration: "4h",
    durationSeconds: 14400,
    chainlinkFeed: "0x64c911996D3E4C1C4249AD8fed065adBfF64B5C6",
    coingeckoId: "bitcoin",
  },
  {
    id: "btc-1d",
    asset: "BTC",
    duration: "1d",
    durationSeconds: 86400,
    chainlinkFeed: "0x64c911996D3E4C1C4249AD8fed065adBfF64B5C6",
    coingeckoId: "bitcoin",
  },
  {
    id: "eth-1h",
    asset: "ETH",
    duration: "1h",
    durationSeconds: 3600,
    chainlinkFeed: "0x71041dddad3595F064CE71DD0dfAcB7ed865cdb0",
    coingeckoId: "ethereum",
  },
  {
    id: "eth-4h",
    asset: "ETH",
    duration: "4h",
    durationSeconds: 14400,
    chainlinkFeed: "0x71041dddad3595F064CE71DD0dfAcB7ed865cdb0",
    coingeckoId: "ethereum",
  },
  {
    id: "eth-1d",
    asset: "ETH",
    duration: "1d",
    durationSeconds: 86400,
    chainlinkFeed: "0x71041dddad3595F064CE71DD0dfAcB7ed865cdb0",
    coingeckoId: "ethereum",
  },
  {
    id: "sol-1h",
    asset: "SOL",
    duration: "1h",
    durationSeconds: 3600,
    // Pyth SOL/USD on Base — update after deploy if feed changes
    chainlinkFeed: "0x9a4df90bA880AE46eD79d6fC07A9751b5D7fEe49",
    coingeckoId: "solana",
  },
  {
    id: "sol-4h",
    asset: "SOL",
    duration: "4h",
    durationSeconds: 14400,
    chainlinkFeed: "0x9a4df90bA880AE46eD79d6fC07A9751b5D7fEe49",
    coingeckoId: "solana",
  },
  {
    id: "sol-1d",
    asset: "SOL",
    duration: "1d",
    durationSeconds: 86400,
    chainlinkFeed: "0x9a4df90bA880AE46eD79d6fC07A9751b5D7fEe49",
    coingeckoId: "solana",
  },
];

export const PREDICTION_ASSETS: PredictionAsset[] = ["BTC", "ETH", "SOL"];

export const PREDICTION_DURATIONS: { id: PredictionDuration; label: string }[] = [
  { id: "1h", label: "1 Hour" },
  { id: "4h", label: "4 Hours" },
  { id: "1d", label: "Daily" },
];

export function trackFor(
  asset: PredictionAsset,
  duration: PredictionDuration
): MarketTrack | undefined {
  return MARKET_TRACKS.find((t) => t.asset === asset && t.duration === duration);
}

export const DURATION_LABEL: Record<PredictionDuration, string> = {
  "1h": "1H",
  "4h": "4H",
  "1d": "Daily",
};

export const ASSET_COLOR: Record<PredictionAsset, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
};
