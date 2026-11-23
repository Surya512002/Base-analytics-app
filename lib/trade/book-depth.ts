/**
 * Turns the order book contract's raw orders into the two sides of a classic order book.
 * Only resting LIMIT orders are shown: stop-losses and the legs of a take-profit/stop-loss pair
 * are protection, not offers, so (like on an exchange) they stay out of the public depth.
 */

export type RawBookOrder = {
  id: bigint;
  owner: string;
  expiry: number;
  orderType: number; // 0 LIMIT_BUY, 1 LIMIT_SELL, 2 STOP_LOSS, 3 TRAILING_STOP
  status: number; // 1 OPEN
  stockToken: string;
  triggerPrice: bigint; // 8 decimals
  amountIn: bigint; // quote units for buys, stock units for sells
  linkedId: bigint;
};

export type BookLevel = {
  price: number;
  /** Size in stock/coin units. */
  size: number;
  /** Running total from the best price outwards. */
  total: number;
  orders: number;
  mine: boolean;
};

const PRICE_SCALE = 1e8;

const units = (v: bigint, decimals: number) => Number(v) / 10 ** decimals;

export function aggregateBook(
  orders: readonly RawBookOrder[],
  opts: { stockToken: string; stockDecimals: number; quoteDecimals: number; nowSec: number; wallet?: string | null }
): { bids: BookLevel[]; asks: BookLevel[] } {
  const token = opts.stockToken.toLowerCase();
  const me = opts.wallet?.toLowerCase();
  const bids = new Map<bigint, BookLevel>();
  const asks = new Map<bigint, BookLevel>();

  for (const o of orders) {
    if (o.status !== 1 || o.stockToken.toLowerCase() !== token) continue;
    if (o.expiry <= opts.nowSec || o.triggerPrice <= BigInt(0) || o.amountIn <= BigInt(0)) continue;
    const isBuy = o.orderType === 0;
    const isSell = o.orderType === 1 && o.linkedId === BigInt(0);
    if (!isBuy && !isSell) continue;

    const price = Number(o.triggerPrice) / PRICE_SCALE;
    const size = isBuy ? units(o.amountIn, opts.quoteDecimals) / price : units(o.amountIn, opts.stockDecimals);
    const side = isBuy ? bids : asks;
    const level = side.get(o.triggerPrice) ?? { price, size: 0, total: 0, orders: 0, mine: false };
    level.size += size;
    level.orders += 1;
    level.mine = level.mine || o.owner.toLowerCase() === me;
    side.set(o.triggerPrice, level);
  }

  const finish = (m: Map<bigint, BookLevel>, bestFirst: (a: BookLevel, b: BookLevel) => number) => {
    const list = [...m.values()].sort(bestFirst);
    let run = 0;
    for (const l of list) {
      run += l.size;
      l.total = run;
    }
    return list;
  };
  return {
    bids: finish(bids, (a, b) => b.price - a.price), // highest bid first
    asks: finish(asks, (a, b) => a.price - b.price), // lowest ask first
  };
}
