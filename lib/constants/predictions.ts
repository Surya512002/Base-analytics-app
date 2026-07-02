import { APP_TREASURY } from "@/lib/constants/treasury";

export { APP_TREASURY };

/** Disclosed protocol fee taken from pool on settlement (basis points). */
export const PROTOCOL_FEE_BPS = 150; // 1.5%

export const PROTOCOL_FEE_LABEL = "1.5%";

export type PredictionAsset = "BTC" | "ETH" | "SOL";

export type PredictionDuration = "15m" | "1h" | "4h" | "1d";

export interface MarketTrack {
  id: string;
  asset: PredictionAsset;
  duration: PredictionDuration;
  durationSeconds: number;
  /** Chainlink AggregatorV3 proxy on Base (use proxy, not v4 aggregator). */
  chainlinkFeed: `0x${string}`;
  coingeckoId: string;
  /** When false, track stays demo until a feed adapter is deployed (e.g. SOL on Base). */
  onChainEnabled?: boolean;
}

/** Twelve concurrent tracks: BTC / ETH / SOL × 15m / 1h / 4h / 1d */
export const MARKET_TRACKS: MarketTrack[] = [
  {
    id: "btc-15m",
    asset: "BTC",
    duration: "15m",
    durationSeconds: 900,
    chainlinkFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    coingeckoId: "bitcoin",
  },
  {
    id: "btc-1h",
    asset: "BTC",
    duration: "1h",
    durationSeconds: 3600,
    chainlinkFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    coingeckoId: "bitcoin",
  },
  {
    id: "btc-4h",
    asset: "BTC",
    duration: "4h",
    durationSeconds: 14400,
    chainlinkFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    coingeckoId: "bitcoin",
  },
  {
    id: "btc-1d",
    asset: "BTC",
    duration: "1d",
    durationSeconds: 86400,
    chainlinkFeed: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F",
    coingeckoId: "bitcoin",
  },
  {
    id: "eth-15m",
    asset: "ETH",
    duration: "15m",
    durationSeconds: 900,
    chainlinkFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    coingeckoId: "ethereum",
  },
  {
    id: "eth-1h",
    asset: "ETH",
    duration: "1h",
    durationSeconds: 3600,
    chainlinkFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    coingeckoId: "ethereum",
  },
  {
    id: "eth-4h",
    asset: "ETH",
    duration: "4h",
    durationSeconds: 14400,
    chainlinkFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    coingeckoId: "ethereum",
  },
  {
    id: "eth-1d",
    asset: "ETH",
    duration: "1d",
    durationSeconds: 86400,
    chainlinkFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    coingeckoId: "ethereum",
  },
  {
    id: "sol-15m",
    asset: "SOL",
    duration: "15m",
    durationSeconds: 900,
    chainlinkFeed: "0xDa5Fd22F9382e57534fEdA4fF544878aa1cf401f",
    coingeckoId: "solana",
  },
  {
    id: "sol-1h",
    asset: "SOL",
    duration: "1h",
    durationSeconds: 3600,
    chainlinkFeed: "0xDa5Fd22F9382e57534fEdA4fF544878aa1cf401f",
    coingeckoId: "solana",
  },
  {
    id: "sol-4h",
    asset: "SOL",
    duration: "4h",
    durationSeconds: 14400,
    chainlinkFeed: "0xDa5Fd22F9382e57534fEdA4fF544878aa1cf401f",
    coingeckoId: "solana",
  },
  {
    id: "sol-1d",
    asset: "SOL",
    duration: "1d",
    durationSeconds: 86400,
    chainlinkFeed: "0xDa5Fd22F9382e57534fEdA4fF544878aa1cf401f",
    coingeckoId: "solana",
  },
];

export const PREDICTION_ASSETS: PredictionAsset[] = ["BTC", "ETH", "SOL"];

export const PREDICTION_DURATIONS: { id: PredictionDuration; label: string }[] = [
  { id: "15m", label: "15 Min" },
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
  "15m": "15M",
  "1h": "1H",
  "4h": "4H",
  "1d": "Daily",
};

/** Virtual CPMM liquidity seeded per `openMarket` (USDC, 6 decimals on-chain). */
export const DEFAULT_OPEN_LIQUIDITY_USDC = 10_000;

export const ASSET_COLOR: Record<PredictionAsset, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
};
