"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { CheckCircle2, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import {
  PRICE_DECIMALS,
  expectedAmountOut,
  minAmountOut,
  parseDecimalInput,
  validateBracket,
  validateOrder,
  type OrderKind,
  ORDER_TYPE_INDEX,
} from "@/src/lib/limitOrders/orderMath";
import {
  GOAL_COPY,
  GOAL_PRESETS,
  distancePct,
  movePrice,
  oracleHealth,
  sizeAdvice,
  type SimpleGoal,
} from "@/lib/trade/safety";
import { formatPrice } from "./CandleChart";

const EXPIRIES = [
  { label: "1 day", seconds: 86_400 },
  { label: "7 days", seconds: 7 * 86_400 },
  { label: "30 days", seconds: 30 * 86_400 },
];

const GOALS: SimpleGoal[] = ["buy-dip", "take-profit", "stop-loss", "protect"];

const priceToNumber = (p: bigint | null) => (p == null ? null : Number(p) / 10 ** PRICE_DECIMALS);

function fmtAmount(v: bigint, decimals: number): string {
  const n = Number(formatUnits(v, decimals));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  return n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : n.toPrecision(3);
}

type Props = {
  limitOrders: ReturnType<typeof useLimitOrders>;
  stockAddress: string | undefined;
  liquidityUsd?: number | null;
  onConnectWallet?: () => void;
  /** Open on this goal (e.g. from a "Stop-loss" link on a stock card). */
  initialGoal?: SimpleGoal;
};

export default function SimpleOrderCard({ limitOrders, stockAddress, liquidityUsd, onConnectWallet, initialGoal }: Props) {
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
    placeOrder,
    placeBracket,
    placeBuyWithExits,
  } = limitOrders;

  const [goal, setGoal] = useState<SimpleGoal>(initialGoal ?? "buy-dip");
  const [amountInput, setAmountInput] = useState("");
  const [pct, setPct] = useState<number>(GOAL_PRESETS[initialGoal ?? "buy-dip"][1]);
  const [customPct, setCustomPct] = useState("");
  const [slPct, setSlPct] = useState<number>(-5); // protect goal: loss limit
  const [expiry, setExpiry] = useState(EXPIRIES[1].seconds);
  // Buy the dip: optionally protect the tokens the moment the buy fills
  const [protectAfterBuy, setProtectAfterBuy] = useState(false);
  const [afterTpPct, setAfterTpPct] = useState(10);
  const [afterSlPct, setAfterSlPct] = useState(-5);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 5_000);
    return () => clearInterval(t);
  }, []);

  // Reset target when the goal changes
  useEffect(() => {
    setPct(GOAL_PRESETS[goal][1]);
    setCustomPct("");
    setAmountInput("");
  }, [goal]);

  const market = stockAddress ? marketStates[stockAddress.toLowerCase()] : undefined;
  const sym = market?.symbol ?? "token";
  const stockDec = market?.decimals ?? 8;
  const quoteDec = config.quoteToken.decimals;
  const quoteSym = config.quoteToken.symbol;
  const cur = market?.currentPrice ?? null;

  const isBuy = goal === "buy-dip";
  const inDec = isBuy ? quoteDec : stockDec;
  const inSym = isBuy ? quoteSym : sym;
  const balance = isBuy ? quoteBalance : (market?.userBalance ?? 0n);
  const allowance = isBuy ? quoteAllowance : (market?.userAllowance ?? 0n);
  const marketCfg = config.markets.find((m) => m.stockToken.toLowerCase() === stockAddress?.toLowerCase());
  const cap = isBuy
    ? (market?.maxQuoteIn ?? marketCfg?.maxQuoteIn ?? config.maxQuoteIn)
    : (market?.maxStockIn ?? marketCfg?.maxStockIn ?? config.maxStockIn);

  // Chosen % (custom wins). Buy/stop are below the price, take-profit above.
  const activePct = useMemo(() => {
    if (customPct.trim() !== "") {
      const n = parseFloat(customPct);
      if (!Number.isFinite(n)) return null;
      const mag = Math.abs(n);
      return goal === "take-profit" || goal === "protect" ? mag : -mag;
    }
    return pct;
  }, [customPct, pct, goal]);

  const amountIn = useMemo(() => parseDecimalInput(amountInput, inDec), [amountInput, inDec]);
  const slippageBps = goal === "buy-dip" || goal === "take-profit" ? 100 : 200;

  const trigger = cur != null && activePct != null ? movePrice(cur, activePct) : null;
  const stopTrigger = cur != null ? movePrice(cur, slPct) : null;

  const kind: Exclude<OrderKind, "TRAILING_STOP"> =
    goal === "buy-dip" ? "LIMIT_BUY" : goal === "take-profit" ? "LIMIT_SELL" : "STOP_LOSS";

  const expectedMain =
    amountIn && trigger
      ? expectedAmountOut(goal === "protect" ? "LIMIT_SELL" : kind, amountIn, trigger, stockDec, quoteDec)
      : 0n;
  const minMain = expectedMain > 0n ? minAmountOut(expectedMain, slippageBps) : 0n;
  const expectedStop =
    goal === "protect" && amountIn && stopTrigger ? expectedAmountOut("STOP_LOSS", amountIn, stopTrigger, stockDec, quoteDec) : 0n;
  const minStop = expectedStop > 0n ? minAmountOut(expectedStop, slippageBps) : 0n;

  const targetExpiry = nowSec + expiry;
  const common = { amountIn, slippageBps, keeperFeeBps, balance, maxAmountIn: cap, expiry: targetExpiry, nowSec };

  const error = useMemo(() => {
    if (!market) return "Pick a market that supports orders.";
    if (cur == null) return "Waiting for the price feed…";
    if (activePct == null || trigger == null) return "Choose a price target.";
    if (goal === "protect") {
      if (activePct <= 0) return "Profit target must be above the price.";
      if (slPct >= 0) return "Loss limit must be below the price.";
      return validateBracket({ ...common, takeProfit: trigger, stopLoss: stopTrigger, currentPrice: cur });
    }
    return validateOrder({ ...common, kind, trigger, currentPrice: cur });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, cur, activePct, trigger, stopTrigger, goal, slPct, amountIn, balance, cap, targetExpiry, slippageBps, keeperFeeBps]);

  const oracle = market ? oracleHealth(market.updatedAt, marketCfg?.maxStalenessSeconds ?? 90_000, nowSec) : null;

  const orderUsd = useMemo(() => {
    if (!amountIn) return null;
    const px = priceToNumber(cur);
    if (isBuy) return Number(formatUnits(amountIn, quoteDec));
    return px != null ? Number(formatUnits(amountIn, stockDec)) * px : null;
  }, [amountIn, cur, isBuy, quoteDec, stockDec]);
  const advice = sizeAdvice(orderUsd, liquidityUsd);

  const needsApproval = !!amountIn && allowance < amountIn;
  const blocked = paused || regionRestricted || !market?.enabled;

  const setPercentOfBalance = (p: number) => {
    if (balance <= 0n) return;
    const part = (balance * BigInt(p)) / 100n;
    setAmountInput(formatUnits(part > cap ? cap : part, inDec));
  };

  const afterTp = goal === "buy-dip" && protectAfterBuy && trigger != null ? movePrice(trigger, afterTpPct) : null;
  const afterSl = goal === "buy-dip" && protectAfterBuy && trigger != null ? movePrice(trigger, afterSlPct) : null;

  const submit = async () => {
    if (error || !amountIn || !market || trigger == null) return;
    const stockToken = market.stockToken as Address;
    if (goal === "buy-dip" && protectAfterBuy && afterTp && afterSl) {
      const hash = await placeBuyWithExits({
        stockToken,
        amountIn,
        triggerPrice: trigger,
        minAmountOut: minMain,
        expiry: targetExpiry,
        takeProfitPrice: afterTp,
        stopLossPrice: afterSl,
        exitSlippageBps: 200,
        exitDurationSec: 30 * 86_400,
      });
      if (hash) setAmountInput("");
      return;
    }
    if (goal === "protect") {
      if (stopTrigger == null) return;
      const hash = await placeBracket({
        stockToken,
        amountIn,
        takeProfitPrice: trigger,
        stopLossPrice: stopTrigger,
        minOutTakeProfit: minMain,
        minOutStopLoss: minStop,
        expiry: targetExpiry,
      });
      if (hash) setAmountInput("");
      return;
    }
    const hash = await placeOrder({
      stockToken,
      orderType: ORDER_TYPE_INDEX[kind],
      amountIn,
      triggerPrice: trigger,
      minAmountOut: minMain,
      expiry: targetExpiry,
      label: GOAL_COPY[goal].title,
    });
    if (hash) setAmountInput("");
  };

  const priceNum = priceToNumber(cur);
  const triggerNum = priceToNumber(trigger);
  const stopNum = priceToNumber(stopTrigger);

  // Plain-English summary
  const summary = (() => {
    if (!amountIn || triggerNum == null || !market) return null;
    const amt = `${fmtAmount(amountIn, inDec)} ${inSym}`;
    if (goal === "buy-dip") {
      return `If ${sym} falls to $${formatPrice(triggerNum)} (${activePct}%), we'll spend ${amt} to buy about ${fmtAmount(expectedMain, stockDec)} ${sym}.`;
    }
    if (goal === "take-profit") {
      return `If ${sym} rises to $${formatPrice(triggerNum)} (+${activePct}%), we'll sell ${amt} for about ${fmtAmount(expectedMain, quoteDec)} ${quoteSym}.`;
    }
    if (goal === "stop-loss") {
      return `If ${sym} falls to $${formatPrice(triggerNum)} (${activePct}%), we'll sell ${amt} for about ${fmtAmount(expectedMain, quoteDec)} ${quoteSym} to limit your loss.`;
    }
    return `Selling ${amt}: at $${formatPrice(triggerNum)} (+${activePct}%) you get about ${fmtAmount(expectedMain, quoteDec)} ${quoteSym}. If it falls to $${formatPrice(stopNum ?? 0)} (${slPct}%) you get about ${fmtAmount(expectedStop, quoteDec)} ${quoteSym}. Whichever happens first cancels the other.`;
  })();

  const worstCase = goal === "protect" ? minStop : minMain;
  const worstSym = isBuy ? sym : quoteSym;
  const worstDec = isBuy ? stockDec : quoteDec;

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-card sm:p-5">
      <div>
        <h3 className="text-base font-extrabold text-[var(--ink)]">What do you want to do?</h3>
        <p className="text-xs text-[var(--ink-muted)]">Set it once. We act for you while you&apos;re away, and your funds stay yours.</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Order goal">
        {GOALS.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={goal === g}
            onClick={() => setGoal(g)}
            className={`min-h-[56px] rounded-xl border p-2.5 text-left transition ${
              goal === g
                ? "border-[var(--brand-text)] bg-[var(--brand-soft)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
            }`}
          >
            <span className="block text-sm font-bold text-[var(--ink)]">{GOAL_COPY[g].title}</span>
            <span className="block text-[10px] leading-tight text-[var(--ink-muted)]">{g === "buy-dip" ? "Limit buy" : g === "take-profit" ? "Take-profit" : g === "stop-loss" ? "Stop-loss" : "OCO bracket"}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--ink-muted)]">{GOAL_COPY[goal].blurb}</p>

      {oracle && oracle.state !== "fresh" && oracle.state !== "unknown" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-500">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{oracle.label}. {oracle.state === "stale" ? "Stocks may be on a market break." : ""}</span>
        </div>
      )}

      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="simple-amount" className="font-semibold text-[var(--ink)]">
            {isBuy ? `How much ${quoteSym} to spend` : `How much ${sym} to sell`}
          </label>
          <span className="text-[var(--ink-muted)]">Balance {fmtAmount(balance, inDec)} {inSym}</span>
        </div>
        <div className="relative">
          <input
            id="simple-amount"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="0.00"
            className="h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 pr-16 font-mono text-base text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ink-muted)]">{inSym}</span>
        </div>
        <div className="flex gap-1">
          {[25, 50, 75, 100].map((p) => (
            <button key={p} type="button" onClick={() => setPercentOfBalance(p)} className="min-h-[32px] flex-1 rounded-lg bg-[var(--surface-2)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
              {p === 100 ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--ink-muted)]">Limit per order: {fmtAmount(cap, inDec)} {inSym}. Raised as safety checks complete.</p>
      </div>

      {/* Target */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--ink)]">{goal === "protect" ? "Profit target" : goal === "buy-dip" ? "Buy if price drops by" : goal === "take-profit" ? "Sell if price rises by" : "Sell if price drops by"}</span>
          <span className="text-[var(--ink-muted)]">Now ${priceNum != null ? formatPrice(priceNum) : "—"}</span>
        </div>
        <div className="flex gap-1">
          {GOAL_PRESETS[goal].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={customPct === "" && pct === p}
              onClick={() => { setPct(p); setCustomPct(""); }}
              className={`min-h-[36px] flex-1 rounded-lg text-xs font-bold ${customPct === "" && pct === p ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {p > 0 ? `+${p}%` : `${p}%`}
            </button>
          ))}
          <input
            aria-label="Custom percent"
            inputMode="decimal"
            value={customPct}
            onChange={(e) => setCustomPct(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Custom %"
            className="h-9 w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-center text-base sm:text-xs text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
          />
        </div>
        {triggerNum != null && priceNum != null && (
          <p className="text-[11px] text-[var(--ink-muted)]">
            Trigger price <b className="text-[var(--ink)]">${formatPrice(triggerNum)}</b> ({(distancePct(priceNum, triggerNum) ?? 0).toFixed(1)}% from now)
          </p>
        )}
      </div>

      {goal === "buy-dip" && (
        <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-xs font-bold text-[var(--ink)]">Protect it after buying</span>
              <span className="block text-[11px] text-[var(--ink-muted)]">When the buy fills, a take-profit and stop-loss are set on what you bought, automatically.</span>
            </span>
            <input type="checkbox" checked={protectAfterBuy} onChange={(e) => setProtectAfterBuy(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
          </label>
          {protectAfterBuy && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Take profit</span>
                <div className="flex gap-1">
                  {[5, 10, 20].map((p) => (
                    <button key={p} type="button" aria-pressed={afterTpPct === p} onClick={() => setAfterTpPct(p)} className={`min-h-[32px] flex-1 rounded-lg text-[11px] font-bold ${afterTpPct === p ? "bg-green-600 text-white" : "bg-[var(--surface)] text-[var(--ink-muted)]"}`}>+{p}%</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Stop loss</span>
                <div className="flex gap-1">
                  {[-3, -5, -10].map((p) => (
                    <button key={p} type="button" aria-pressed={afterSlPct === p} onClick={() => setAfterSlPct(p)} className={`min-h-[32px] flex-1 rounded-lg text-[11px] font-bold ${afterSlPct === p ? "bg-red-600 text-white" : "bg-[var(--surface)] text-[var(--ink-muted)]"}`}>{p}%</button>
                  ))}
                </div>
              </div>
              {afterTp && afterSl && (
                <p className="col-span-2 text-[11px] text-[var(--ink-muted)]">
                  From your buy price: sell at <b className="text-[var(--ink)]">${formatPrice(priceToNumber(afterTp) ?? 0)}</b> for profit, or at <b className="text-[var(--ink)]">${formatPrice(priceToNumber(afterSl) ?? 0)}</b> to limit loss. Open for 30 days after the buy.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {goal === "protect" && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--ink)]">Loss limit (sell if price drops by)</span>
          <div className="flex gap-1">
            {[-3, -5, -10, -15].map((p) => (
              <button key={p} type="button" aria-pressed={slPct === p} onClick={() => setSlPct(p)} className={`min-h-[36px] flex-1 rounded-lg text-xs font-bold ${slPct === p ? "bg-red-600 text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expiry */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-[var(--ink)]">Cancel automatically after</span>
        <div className="flex gap-1">
          {EXPIRIES.map((e) => (
            <button key={e.seconds} type="button" aria-pressed={expiry === e.seconds} onClick={() => setExpiry(e.seconds)} className={`min-h-[34px] flex-1 rounded-lg text-xs font-semibold ${expiry === e.seconds ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs">
          <p className="leading-relaxed text-[var(--ink)]">{summary}</p>
          {worstCase > 0n && (
            <p className="text-[var(--ink-muted)]">
              Worst case you still receive at least <b className="text-[var(--ink)]">{fmtAmount(worstCase, worstDec)} {worstSym}</b> after fees, or the order simply waits.
            </p>
          )}
        </div>
      )}

      {advice.message && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-500">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{advice.message}</span>
        </div>
      )}

      {/* Safety checklist */}
      <ul className="space-y-1 text-[11px] text-[var(--ink-muted)]" aria-label="Safety">
        {[
          "Your funds sit in the order contract. Cancel and withdraw any time, even if orders are paused.",
          "Fills are checked against the Chainlink price and refused if too far off.",
          `Execution fee ${(keeperFeeBps / 100).toFixed(2)}%, taken only when your order fills.`,
        ].map((t) => (
          <li key={t} className="flex gap-1.5"><ShieldCheck size={13} className="mt-px shrink-0 text-emerald-500" />{t}</li>
        ))}
      </ul>

      {/* Action */}
      {!walletAddress ? (
        <button type="button" onClick={onConnectWallet} className="min-h-[48px] w-full rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)]">
          Connect wallet
        </button>
      ) : blocked ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-muted)]"><Lock size={14} /> New orders are unavailable right now. You can still cancel existing ones.</div>
      ) : needsApproval && !error ? (
        <button
          type="button"
          disabled={txSubmitting}
          onClick={() => amountIn && approveToken(isBuy ? config.quoteToken.address : (market!.stockToken as Address), amountIn, inSym)}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
        >
          {txSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Step 1 of 2: Allow {inSym}
        </button>
      ) : (
        <button
          type="button"
          disabled={Boolean(error) || txSubmitting}
          onClick={() => void submit()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:pointer-events-none disabled:opacity-50"
        >
          {txSubmitting ? <><Loader2 size={16} className="animate-spin" /> Confirm in your wallet…</> : error ? error : `Set up: ${GOAL_COPY[goal].title}`}
        </button>
      )}

      {txSuccessHash && (
        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-500">
          <CheckCircle2 size={14} /> Done. Track it under Open orders.
        </div>
      )}
    </div>
  );
}
