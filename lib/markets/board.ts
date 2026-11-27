/** One list of everything that trades: stocks, other Base tokens and tokens launched here. Pure. */

export type MarketKind = "stock" | "token" | "launched";

export type MarketItem = {
  kind: MarketKind;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  iconUrl?: string;
  createdAt?: number;
};

/** Below these, one small trade can move a price a long way, so it is not ranked as a mover. */
export const MOVER_MIN_VOLUME = 10_000;
export const MOVER_MIN_LIQUIDITY = 10_000;

const ranked = (items: MarketItem[]) =>
  items.filter(
    (x) =>
      x.priceUsd !== null &&
      (x.volume24h ?? 0) >= MOVER_MIN_VOLUME &&
      (x.kind === "stock" || (x.liquidityUsd ?? 0) >= MOVER_MIN_LIQUIDITY)
  );

export const topGainers = (items: MarketItem[], n: number) =>
  ranked(items).filter((x) => (x.change24h ?? 0) > 0).sort((a, b) => b.change24h! - a.change24h!).slice(0, n);

export const topLosers = (items: MarketItem[], n: number) =>
  ranked(items).filter((x) => (x.change24h ?? 0) < 0).sort((a, b) => a.change24h! - b.change24h!).slice(0, n);

export const mostTradedItems = (items: MarketItem[], n: number) =>
  ranked(items).sort((a, b) => b.volume24h! - a.volume24h!).slice(0, n);

export const newestLaunches = (items: MarketItem[], n: number) =>
  items.filter((x) => x.kind === "launched").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, n);

export type Rect<T> = { item: T; x: number; y: number; w: number; h: number };

/**
 * Splits a 100 × 100 box among items by weight: halve the weight, cut the longer side, repeat.
 * `aspect` is the box's real width ÷ height, so tiles stay close to square.
 */
export function treemap<T>(items: Array<{ item: T; weight: number }>, aspect = 2): Rect<T>[] {
  const out: Rect<T>[] = [];
  const place = (list: typeof items, x: number, y: number, w: number, h: number) => {
    if (list.length === 0) return;
    if (list.length === 1) return void out.push({ item: list[0]!.item, x, y, w, h });
    const total = list.reduce((a, i) => a + i.weight, 0);
    let acc = list[0]!.weight;
    let k = 1;
    while (k < list.length - 1 && acc + list[k]!.weight / 2 < total / 2) acc += list[k++]!.weight;
    const f = acc / total;
    if (w * aspect >= h) {
      place(list.slice(0, k), x, y, w * f, h);
      place(list.slice(k), x + w * f, y, w * (1 - f), h);
    } else {
      place(list.slice(0, k), x, y, w, h * f);
      place(list.slice(k), x, y + h * f, w, h * (1 - f));
    }
  };
  place(items.filter((i) => i.weight > 0).sort((a, b) => b.weight - a.weight), 0, 0, 100, 100);
  return out;
}
