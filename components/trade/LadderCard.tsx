"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { CheckCircle2, Layers, Loader2, Lock, ShieldCheck } from "lucide-react";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import {
  PRICE_DECIMALS,
  ORDER_TYPE_INDEX,
  expectedAmountOut,
  minAmountOut,
  parseDecimalInput,
  validateOrder,
} from "@/src/lib/limitOrders/orderMath";
import { LADDER_RANGES, ladderOffsets, movePrice, splitEvenly } from "@/lib/trade/safety";
import { formatPrice } from "./CandleChart";

const COUNTS = [3, 5, 8, 10];
const EXPIRIES = [
  { label: "7 days", seconds: 7 * 86_400 },
  { label: "30 days", seconds: 30 * 86_400 },
  { label: "90 days", seconds: 90 * 86_400 },
];
const SLIPPAGE_BPS = 100;

const px = (p: bigint) => Number(p) / 10 ** PRICE_DECIMALS;

function fmt(v: bigint, decimals: number): string {
  const n = Number(formatUnits(v, decimals));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  return n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : n.toPrecision(3);
}

type Props = {
  limitOrders: ReturnType<typeof useLimitOrders>;
  stockAddress: string | undefined;
  onConnectWallet?: () => void;
};

/** Scale in / scale out: several limit orders across a price range, placed with one confirmation. */
export default function LadderCard({ limitOrders, stockAddress, onConnectWallet }: Props) {
  const {
    config,
    walletAddress,
    paused,
    regionRestricted,
    keeperFeeBps,
    quoteBalance,
    quoteAllowance,
    marketStates,
    txSubmitting,
    txSuccessHash,
    approveToken,
    placeOrderBatch,
  } = limitOrders;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [totalInput, setTotalInput] = useState("");
  const [count, setCount] = useState(5);
  const [rangeIdx, setRangeIdx] = useState(1);
  const [expiry, setExpiry] = useState(EXPIRIES[1].seconds);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setTotalInput(""), [side]);

  const isBuy = side === "buy";
  const market = stockAddress ? marketStates[stockAddress.toLowerCase()] : undefined;
  const marketCfg = config.markets.find((m) => m.stockToken.toLowerCase() === stockAddress?.toLowerCase());
  const sym = market?.symbol ?? marketCfg?.symbol ?? "token";
  const stockDec = market?.decimals ?? marketCfg?.decimals ?? 8;
  const quoteDec = config.quoteToken.decimals;
  const quoteSym = config.quoteToken.symbol;
  const cur = market?.currentPrice ?? null;

  const inDec = isBuy ? quoteDec : stockDec;
  const inSym = isBuy ? quoteSym : sym;
  const balance = isBuy ? quoteBalance : (market?.userBalance ?? 0n);
  const allowance = isBuy ? quoteAllowance : (market?.userAllowance ?? 0n);
  const cap = isBuy
    ? (market?.maxQuoteIn ?? marketCfg?.maxQuoteIn ?? config.maxQuoteIn)
    : (market?.maxStockIn ?? marketCfg?.maxStockIn ?? config.maxStockIn);

  const range = LADDER_RANGES[side][rangeIdx];
  const total = useMemo(() => parseDecimalInput(totalInput, inDec), [totalInput, inDec]);

  const legs = useMemo(() => {
    if (!total || cur == null) return [];
    const amounts = splitEvenly(total, count);
    const offsets = ladderOffsets(range.start, range.end, count);
    const kind = isBuy ? "LIMIT_BUY" : "LIMIT_SELL";
    return offsets.map((off, i) => {
      const trigger = movePrice(cur, off);
      const amountIn = amounts[i];
      const expected = expectedAmountOut(kind, amountIn, trigger, stockDec, quoteDec);
      return { off, trigger, amountIn, expected, minOut: expected > 0n ? minAmountOut(expected, SLIPPAGE_BPS) : 0n };
    });
  }, [total, cur, count, range, isBuy, stockDec, quoteDec]);

  const error = useMemo(() => {
    if (!market) return "Pick a market that supports orders.";
    if (cur == null) return "Waiting for the price feed…";
    if (!total) return "Enter a total amount.";
    if (total > balance) return "Amount is more than your balance.";
    if (legs.length === 0) return "Enter a total amount.";
    for (const leg of legs) {
      const e = validateOrder({
        kind: isBuy ? "LIMIT_BUY" : "LIMIT_SELL",
        amountIn: leg.amountIn,
        trigger: leg.trigger,
        currentPrice: cur,
        slippageBps: SLIPPAGE_BPS,
        keeperFeeBps,
        balance,
        maxAmountIn: cap,
        expiry: nowSec + expiry,
        nowSec,
      });
      if (e) return e.includes("per-order") ? `Each order is limited to ${fmt(cap, inDec)} ${inSym}. Use more orders or less in total.` : e;
    }
    return null;
  }, [market, cur, total, balance, legs, isBuy, keeperFeeBps, cap, nowSec, expiry, inDec, inSym]);

  const needsApproval = !!total && allowance < total;
  const blocked = paused || regionRestricted || !market?.enabled;

  const submit = async () => {
    if (error || !market) return;
    const hash = await placeOrderBatch({
      stockToken: market.stockToken as Address,
      legs: legs.map((l) => ({ orderType: ORDER_TYPE_INDEX[isBuy ? "LIMIT_BUY" : "LIMIT_SELL"], amountIn: l.amountIn, triggerPrice: l.trigger, minAmountOut: l.minOut })),
      expiry: nowSec + expiry,
      label: isBuy ? "Scale-in" : "Scale-out",
    });
    if (hash) setTotalInput("");
  };

  const totalOut = legs.reduce((a, l) => a + l.expected, 0n);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-card sm:p-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-extrabold text-[var(--ink)]">
          <Layers size={17} className="text-[var(--brand-text)]" /> Scale in or out
        </h3>
        <p className="text-xs text-[var(--ink-muted)]">Spread one decision over several prices. All orders are placed with one confirmation and each fills on its own.</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1" role="group" aria-label="Ladder side">
        {(["buy", "sell"] as const).map((sd) => (
          <button key={sd} type="button" aria-pressed={side === sd} onClick={() => setSide(sd)} className={`min-h-[40px] rounded-lg text-sm font-bold transition ${side === sd ? (sd === "buy" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
            {sd === "buy" ? "Scale in (buy dips)" : "Scale out (sell rallies)"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="ladder-total" className="font-semibold text-[var(--ink)]">{isBuy ? `Total ${quoteSym} to deploy` : `Total ${sym} to sell`}</label>
          <span className="text-[var(--ink-muted)]">Balance {fmt(balance, inDec)} {inSym}</span>
        </div>
        <input id="ladder-total" inputMode="decimal" value={totalInput} onChange={(e) => setTotalInput(e.target.value)} placeholder="0.00" className="h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 font-mono text-base text-[var(--ink)] outline-none focus:border-[var(--brand-text)]" />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-[var(--ink)]">Number of orders</span>
        <div className="flex gap-1">
          {COUNTS.map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`min-h-[36px] flex-1 rounded-lg text-xs font-bold ${count === n ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>{n}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-[var(--ink)]">Price range</span>
        <div className="flex gap-1">
          {LADDER_RANGES[side].map((r, i) => (
            <button key={r.label} type="button" aria-pressed={rangeIdx === i} onClick={() => setRangeIdx(i)} className={`min-h-[40px] flex-1 rounded-lg px-1 text-xs font-bold ${rangeIdx === i ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
              {r.label}
              <span className="block text-[10px] font-medium opacity-80">{r.start > 0 ? "+" : ""}{r.start}% to {r.end > 0 ? "+" : ""}{r.end}%</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-[var(--ink)]">Cancel automatically after</span>
        <div className="flex gap-1">
          {EXPIRIES.map((e) => (
            <button key={e.seconds} type="button" aria-pressed={expiry === e.seconds} onClick={() => setExpiry(e.seconds)} className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold ${expiry === e.seconds ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>{e.label}</button>
          ))}
        </div>
      </div>

      {legs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] text-xs" aria-label="Order preview">
          <div className="grid grid-cols-3 bg-[var(--surface-2)] px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
            <span>Price</span><span className="text-right">{isBuy ? "Spend" : "Sell"}</span><span className="text-right">{isBuy ? "Get ≈" : "Receive ≈"}</span>
          </div>
          {legs.map((l, i) => (
            <div key={i} className="grid grid-cols-3 px-3 py-1 tabular-nums">
              <span className="text-[var(--ink)]">${formatPrice(px(l.trigger))} <span className="text-[var(--ink-muted)]">({l.off}%)</span></span>
              <span className="text-right text-[var(--ink-muted)]">{fmt(l.amountIn, inDec)}</span>
              <span className="text-right text-[var(--ink)]">{fmt(l.expected, isBuy ? stockDec : quoteDec)}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1.5 font-semibold tabular-nums text-[var(--ink)]">
            <span>If all fill</span><span className="text-right">{fmt(total ?? 0n, inDec)}</span><span className="text-right">{fmt(totalOut, isBuy ? stockDec : quoteDec)} {isBuy ? sym : quoteSym}</span>
          </div>
        </div>
      )}

      <ul className="space-y-1 text-[11px] text-[var(--ink-muted)]" aria-label="Safety">
        {[
          "Each order is a normal on-chain limit order with the same Chainlink price protection.",
          "Cancel any single order or all of them. Unfilled amounts return to you.",
          `Execution fee ${(keeperFeeBps / 100).toFixed(2)}% on each fill.`,
        ].map((t) => (
          <li key={t} className="flex gap-1.5"><ShieldCheck size={13} className="mt-px shrink-0 text-emerald-500" />{t}</li>
        ))}
      </ul>

      {!walletAddress ? (
        <button type="button" onClick={onConnectWallet} className="min-h-[48px] w-full rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)]">Connect wallet</button>
      ) : blocked ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-muted)]"><Lock size={14} /> New orders are unavailable right now. You can still cancel existing ones.</div>
      ) : needsApproval && !error ? (
        <button type="button" disabled={txSubmitting} onClick={() => total && approveToken(isBuy ? config.quoteToken.address : (market!.stockToken as Address), total, inSym)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50">
          {txSubmitting && <Loader2 size={16} className="animate-spin" />} Step 1 of 2: Allow {fmt(total ?? 0n, inDec)} {inSym}
        </button>
      ) : (
        <button type="button" disabled={Boolean(error) || txSubmitting} onClick={() => void submit()} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:pointer-events-none disabled:opacity-50">
          {txSubmitting ? <><Loader2 size={16} className="animate-spin" /> Confirm in your wallet…</> : error ? error : `Place ${count} orders`}
        </button>
      )}

      {txSuccessHash && (
        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-500">
          <CheckCircle2 size={14} /> Done. Track your orders under Open orders.
        </div>
      )}
    </div>
  );
}
