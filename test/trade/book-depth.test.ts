import { describe, expect, it } from "vitest";
import { aggregateBook, type RawBookOrder } from "@/lib/trade/book-depth";

const TOKEN = "0xb20000000000000000000078ee7ce2fe4908108c";
const OTHER = "0xb200000000000000000000c2e324d24d7eecd1fb";
const ME = "0x00000000000000000000000000000000000a11ce";
const NOW = 1_800_000_000;

const order = (o: Partial<RawBookOrder>): RawBookOrder => ({
  id: BigInt(1),
  owner: "0x00000000000000000000000000000000000b0b00",
  expiry: NOW + 1000,
  orderType: 0,
  status: 1,
  stockToken: TOKEN,
  triggerPrice: BigInt(130) * BigInt(1e8),
  amountIn: BigInt(0),
  linkedId: BigInt(0),
  ...o,
});
const opts = { stockToken: TOKEN, stockDecimals: 8, quoteDecimals: 6, nowSec: NOW, wallet: ME };

describe("aggregateBook", () => {
  it("builds bids from limit buys (quote converted to size) and asks from limit sells", () => {
    const { bids, asks } = aggregateBook(
      [
        order({ orderType: 0, triggerPrice: BigInt(130) * BigInt(1e8), amountIn: BigInt(26_000_000) }), // $26 at $130 = 0.2
        order({ id: BigInt(2), orderType: 0, triggerPrice: BigInt(128) * BigInt(1e8), amountIn: BigInt(12_800_000) }), // 0.1
        order({ id: BigInt(3), orderType: 1, triggerPrice: BigInt(135) * BigInt(1e8), amountIn: BigInt(30_000_000) }), // 0.3
        order({ id: BigInt(4), orderType: 1, triggerPrice: BigInt(140) * BigInt(1e8), amountIn: BigInt(10_000_000) }), // 0.1
      ],
      opts
    );
    expect(bids.map((l) => l.price)).toEqual([130, 128]); // best (highest) first
    expect(bids[0].size).toBeCloseTo(0.2);
    expect(bids[1].total).toBeCloseTo(0.3);
    expect(asks.map((l) => l.price)).toEqual([135, 140]); // best (lowest) first
    expect(asks[1].total).toBeCloseTo(0.4);
  });

  it("merges orders at the same price and flags the viewer's own", () => {
    const { bids } = aggregateBook(
      [
        order({ orderType: 0, amountIn: BigInt(13_000_000) }),
        order({ id: BigInt(2), orderType: 0, amountIn: BigInt(13_000_000), owner: ME }),
      ],
      opts
    );
    expect(bids).toHaveLength(1);
    expect(bids[0].orders).toBe(2);
    expect(bids[0].mine).toBe(true);
  });

  it("leaves out stops, bracket legs, expired, closed and other markets", () => {
    const { bids, asks } = aggregateBook(
      [
        order({ orderType: 2, amountIn: BigInt(1e8) }), // stop-loss
        order({ id: BigInt(2), orderType: 3, amountIn: BigInt(1e8) }), // trailing stop
        order({ id: BigInt(3), orderType: 1, linkedId: BigInt(4), amountIn: BigInt(1e8) }), // take-profit leg of a bracket
        order({ id: BigInt(5), orderType: 0, expiry: NOW - 1, amountIn: BigInt(1e7) }), // expired
        order({ id: BigInt(6), orderType: 0, status: 2, amountIn: BigInt(1e7) }), // executed
        order({ id: BigInt(7), orderType: 0, stockToken: OTHER, amountIn: BigInt(1e7) }), // other market
      ],
      opts
    );
    expect(bids).toEqual([]);
    expect(asks).toEqual([]);
  });
});
