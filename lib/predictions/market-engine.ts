import {
  MARKET_TRACKS,
  PROTOCOL_FEE_BPS,
  type MarketTrack,
} from "@/lib/constants/predictions";
import {
  DEFAULT_LIQUIDITY,
  type PoolState,
} from "@/lib/predictions/amm";
import type { LiveMarket, MarketPhase, PricePoint, CandlePoint } from "@/lib/predictions/types";

function roundBounds(
  track: MarketTrack,
  now = Date.now()
): { roundId: number; open: number; close: number; resolve: number } {
  const ms = track.durationSeconds * 1000;
  const roundId = Math.floor(now / ms);
  const open = roundId * ms;
  const close = open + ms * 0.9;
  const resolve = open + ms;
  return { roundId, open, close, resolve };
}

export { roundBounds };

function phaseFor(
  track: MarketTrack,
  now = Date.now()
): MarketPhase {
  const { open, close, resolve } = roundBounds(track, now);
  if (now < open) return "open";
  if (now < close) return "open";
  if (now < resolve) return "closed";
  return "resolved";
}

/** Deterministic seed pool per track+round for demo / API sync. */
function seedPool(trackId: string, roundId: number): PoolState {
  const seed = (trackId.charCodeAt(0) + roundId) % 1000;
  const skew = 1 + (seed % 200) / 1000;
  return {
    yesReserve: DEFAULT_LIQUIDITY * skew,
    noReserve: DEFAULT_LIQUIDITY / skew,
  };
}

export function buildLiveMarket(
  track: MarketTrack,
  prices: Record<string, number>,
  now = Date.now()
): LiveMarket {
  const { roundId, open, close, resolve } = roundBounds(track, now);
  const phase = phaseFor(track, now);
  const current = prices[track.coingeckoId] ?? prices[track.asset.toLowerCase()] ?? 0;
  const openPrice = current * (0.998 + (roundId % 7) * 0.0005);
  const resolvePrice = phase === "resolved" ? current : null;
  const yesWins =
    resolvePrice !== null ? resolvePrice > openPrice : null;

  return {
    trackId: track.id,
    asset: track.asset,
    duration: track.duration,
    roundId,
    onChainMarketId: null,
    isOnChain: false,
    phase,
    openTime: open,
    closeTime: close,
    resolveTime: resolve,
    openPrice,
    currentPrice: current,
    resolvePrice,
    pool: seedPool(track.id, roundId),
    yesWins,
    totalVolumeUsdc: 0,
    participants: 0,
    oneSided: false,
  };
}

export function buildAllMarkets(
  prices: Record<string, number>,
  now = Date.now()
): LiveMarket[] {
  return MARKET_TRACKS.map((t) => buildLiveMarket(t, prices, now));
}

export function syntheticPriceHistory(
  asset: string,
  current: number,
  points = 24
): PricePoint[] {
  return syntheticCandleHistory(asset, current, current * 0.998, points).map(
    (c) => ({ t: c.t, price: c.close })
  );
}

/** Deterministic OHLC candles for chart UI (seeded by asset + price). */
export function syntheticCandleHistory(
  asset: string,
  current: number,
  openPrice: number,
  candles = 36,
  intervalMs = 5 * 60_000
): CandlePoint[] {
  const out: CandlePoint[] = [];
  const now = Date.now();
  let close = openPrice;
  const seedBase = asset.charCodeAt(0) + Math.floor(current) % 997;

  for (let i = candles; i >= 0; i--) {
    const w = Math.sin((i + seedBase) * 0.55) * 0.5 + Math.cos(i * 0.31 + seedBase) * 0.5;
    const volPct = 0.0012 + Math.abs(Math.sin(i * 0.42 + seedBase)) * 0.0028;
    const open = close;
    const move = w * volPct * open;
    close = i === 0 ? current : Math.max(open * 0.992, open + move);
    const bodyTop = Math.max(open, close);
    const bodyBot = Math.min(open, close);
    const wick = volPct * open * 0.45;
    const high = bodyTop + wick;
    const low = Math.max(bodyBot - wick, open * 0.985);
    const volume = 40_000 + Math.abs(Math.sin(i * 0.65 + seedBase)) * 180_000;

    out.push({
      t: now - i * intervalMs,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  out[out.length - 1] = { ...out[out.length - 1], close: current, t: now };
  return out;
}

export { PROTOCOL_FEE_BPS };
