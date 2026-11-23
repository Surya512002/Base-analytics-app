"use client";

import { useEffect, useMemo, useState } from "react";
import { aggregateBook, type BookLevel, type RawBookOrder } from "@/lib/trade/book-depth";
import { orderBookAbi } from "@/src/lib/limitOrders/abi";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatPrice } from "./CandleChart";

const WINDOW = 400; // newest orders scanned; the book is young, so this covers everything for now
const CHUNK = 200;
const ROWS = 8;

function fmtSize(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(2);
}

type Item = { orderType: number; status: number; stockToken: string; owner: string; expiry: number; triggerPrice: bigint; amountIn: bigint; linkedId: bigint };

/**
 * Public order book of resting limit orders on our contract for this market, read straight from
 * the chain. It is separate from the pool price: a limit order here waits for the Chainlink price to
 * reach it, then is filled through the pool by the keeper.
 */
export default function OrderBookPanel({
  orderBook,
  chainId,
  stockToken,
  stockDecimals,
  quoteDecimals,
  symbol,
  wallet,
  poolPrice,
  oraclePrice,
  onPickPrice,
}: {
  orderBook: `0x${string}`;
  chainId: number;
  stockToken: string;
  stockDecimals: number;
  quoteDecimals: number;
  symbol: string;
  wallet?: string | null;
  poolPrice: number | null;
  oraclePrice: number | null;
  onPickPrice?: (price: number) => void;
}) {
  const [orders, setOrders] = useState<RawBookOrder[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (chainId !== 8453) {
      setState("ready");
      setOrders([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const client = createBasePublicClient();
        const next = (await client.readContract({ address: orderBook, abi: orderBookAbi, functionName: "nextOrderId" })) as bigint;
        const last = next - BigInt(1);
        const first = last > BigInt(WINDOW) ? last - BigInt(WINDOW) + BigInt(1) : BigInt(1);
        const all: RawBookOrder[] = [];
        for (let from = first; from <= last; from += BigInt(CHUNK)) {
          const to = from + BigInt(CHUNK) - BigInt(1) > last ? last : from + BigInt(CHUNK) - BigInt(1);
          const [ids, list] = (await client.readContract({
            address: orderBook,
            abi: orderBookAbi,
            functionName: "getOrdersRange",
            args: [from, to],
          })) as unknown as [bigint[], Item[]];
          list.forEach((o, i) => all.push({ id: ids[i], owner: o.owner, expiry: Number(o.expiry), orderType: Number(o.orderType), status: Number(o.status), stockToken: o.stockToken, triggerPrice: o.triggerPrice, amountIn: o.amountIn, linkedId: o.linkedId }));
        }
        if (!cancelled) {
          setOrders(all);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderBook, chainId]);

  const { bids, asks } = useMemo(
    () => aggregateBook(orders, { stockToken, stockDecimals, quoteDecimals, nowSec: Math.floor(Date.now() / 1000), wallet }),
    [orders, stockToken, stockDecimals, quoteDecimals, wallet]
  );

  const shownAsks = asks.slice(0, ROWS);
  const shownBids = bids.slice(0, ROWS);
  const maxTotal = Math.max(shownAsks.at(-1)?.total ?? 0, shownBids.at(-1)?.total ?? 0, 1e-12);
  const mid = oraclePrice ?? poolPrice;

  const Row = ({ l, side }: { l: BookLevel; side: "bid" | "ask" }) => (
    <button
      type="button"
      onClick={() => onPickPrice?.(l.price)}
      disabled={!onPickPrice}
      title={onPickPrice ? "Use this price in the ticket" : undefined}
      className="relative grid w-full grid-cols-3 gap-2 px-2 py-0.5 text-xs tabular-nums enabled:hover:bg-[var(--surface-2)]"
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 right-0 ${side === "bid" ? "bg-green-500/10" : "bg-red-500/10"}`}
        style={{ width: `${Math.min(100, (l.total / maxTotal) * 100)}%` }}
      />
      <span className={`relative text-left font-semibold ${side === "bid" ? "text-green-600" : "text-red-600"}`}>
        {formatPrice(l.price)}
        {l.mine && <span className="ml-1 rounded bg-[var(--brand-soft)] px-1 text-[9px] font-bold text-[var(--brand-text)]">you</span>}
      </span>
      <span className="relative text-right text-[var(--ink)]">{fmtSize(l.size)}</span>
      <span className="relative text-right text-[var(--ink-muted)]">{fmtSize(l.total)}</span>
    </button>
  );

  return (
    <section aria-label="Order book" className="max-w-xl">
      <div className="mb-1 grid grid-cols-3 gap-2 px-2 text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
        <span>Price (USD)</span>
        <span className="text-right">Size ({symbol})</span>
        <span className="text-right">Total</span>
      </div>
      {state === "loading" && <p className="py-4 text-center text-xs text-[var(--ink-muted)]">Loading the order book…</p>}
      {state === "error" && <p className="py-4 text-center text-xs text-[var(--ink-muted)]">Could not read the order book right now.</p>}
      {state === "ready" && (
        <>
          <div className="flex flex-col-reverse">{shownAsks.map((l) => <Row key={`a${l.price}`} l={l} side="ask" />)}</div>
          <div className="my-1 flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-2 py-1.5 text-xs">
            <span className="font-bold tabular-nums text-[var(--ink)]">{mid != null ? `$${formatPrice(mid)}` : "—"}</span>
            <span className="text-[var(--ink-muted)]">
              {oraclePrice != null ? "Chainlink price" : "Pool price"}
              {bids[0] && asks[0] && ` · spread ${(((asks[0].price - bids[0].price) / asks[0].price) * 100).toFixed(2)}%`}
            </span>
          </div>
          <div>{shownBids.map((l) => <Row key={`b${l.price}`} l={l} side="bid" />)}</div>
          {bids.length === 0 && asks.length === 0 && (
            <p className="py-3 text-center text-xs text-[var(--ink-muted)]">
              No resting limit orders on {symbol} yet. Place one from the Limit tab and it appears here.
            </p>
          )}
        </>
      )}
      <p className="mt-2 px-2 text-[10px] text-[var(--ink-muted)]">
        Resting limit orders on our order book, read from Base. Stops and take-profit/stop-loss pairs are not shown. Orders fill when the Chainlink price reaches them, through the pool, so the book is not the whole market.
      </p>
    </section>
  );
}
