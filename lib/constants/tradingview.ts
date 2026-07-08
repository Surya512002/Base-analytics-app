import type { PredictionAsset, PredictionDuration } from "@/lib/constants/predictions";

/** TradingView chart intervals (widget API values). */
export type TvInterval = "1" | "5" | "15" | "30" | "60" | "240" | "D" | "W";

export const TV_INTERVALS: { id: TvInterval; label: string; group: "intraday" | "swing" }[] = [
  { id: "1", label: "1m", group: "intraday" },
  { id: "5", label: "5m", group: "intraday" },
  { id: "15", label: "15m", group: "intraday" },
  { id: "30", label: "30m", group: "intraday" },
  { id: "60", label: "1h", group: "intraday" },
  { id: "240", label: "4h", group: "intraday" },
  { id: "D", label: "1D", group: "swing" },
  { id: "W", label: "1W", group: "swing" },
];

/** Binance USDT pairs — widely supported on TradingView free widget. */
export const TV_SYMBOLS: Record<PredictionAsset, string> = {
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
};

/** Sensible default candle size per prediction round duration. */
export function defaultIntervalForDuration(duration: PredictionDuration): TvInterval {
  switch (duration) {
    case "4h":
      return "15";
    case "1d":
      return "60";
    default:
      return "15";
  }
}
