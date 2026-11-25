"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { CalendarClock, CheckCircle2, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import {
  PRICE_DECIMALS,
  dcaTotal,
  expectedAmountOut,
  parseDecimalInput,
  validateDca,
  validateDcaSell,
} from "@/src/lib/limitOrders/orderMath";
import { FREQUENCIES, distancePct, formatDuration, movePrice, planSchedule } from "@/lib/trade/safety";
import HoldFirstBuyToggle from "@/components/swap/orders/HoldFirstBuyToggle";
import MyPlansPanel from "@/components/swap/orders/MyPlansPanel";
import { formatPrice } from "./CandleChart";

const RUN_PRESETS = [4, 8, 12, 26, 52];
const GUARD_PRESETS_BUY = [0, -2, -5, -10]; // 0 = no ceiling
const GUARD_PRESETS_SELL = [0, 2, 5, 10]; // 0 = no floor

const priceNum = (p: bigint | null) => (p == null ? null : Number(p) / 10 ** PRICE_DECIMALS);

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

export default function RecurringCard({ limitOrders, stockAddress, onConnectWallet }: Props) {
  const {
    config,
    walletAddress,
    paused,
    regionRestricted,
    quoteBalance,
    quoteAllowance,
    marketStates,
    plans,
    txSubmitting,
    txSuccessHash,
    approveToken,
    createDca,
    createDcaSell,
    cancelDca,
  } = limitOrders;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountInput, setAmountInput] = useState("");
  const [runs, setRuns] = useState(12);
  const [customRuns, setCustomRuns] = useState("");
  const [freq, setFreq] = useState<number>(FREQUENCIES[1].seconds);
  const [customHours, setCustomHours] = useState("");
  const [guardPct, setGuardPct] = useState(0);
  const [holdFirst, setHoldFirst] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setGuardPct(0);
    setAmountInput("");
  }, [side]);

  const isSell = side === "sell";
  const market = stockAddress ? marketStates[stockAddress.toLowerCase()] : undefined;
  const marketCfg = config.markets.find((m) => m.stockToken.toLowerCase() === stockAddress?.toLowerCase());
  const sym = market?.symbol ?? marketCfg?.symbol ?? "token";
  const stockDec = market?.decimals ?? marketCfg?.decimals ?? 8;
  const quoteDec = config.quoteToken.decimals;
  const quoteSym = config.quoteToken.symbol;
  const cur = market?.currentPrice ?? null;
  const curNum = priceNum(cur);

  const unitDec = isSell ? stockDec : quoteDec;
  const unitSym = isSell ? sym : quoteSym;
  const balance = isSell ? (market?.userBalance ?? 0n) : quoteBalance;
  const allowance = isSell ? (market?.userAllowance ?? 0n) : quoteAllowance;
  const cap = isSell
    ? (market?.maxStockIn ?? marketCfg?.maxStockIn ?? config.maxStockIn)
    : (market?.maxQuoteIn ?? marketCfg?.maxQuoteIn ?? config.maxQuoteIn);

  const runCount = useMemo(() => {
    if (customRuns.trim() !== "") {
      const n = Math.floor(Number(customRuns));
      return Number.isFinite(n) ? n : 0;
    }
    return runs;
  }, [customRuns, runs]);
  const intervalSec = useMemo(() => {
    if (customHours.trim() !== "") {
      const h = parseFloat(customHours);
      return Number.isFinite(h) && h >= 1 ? Math.round(h * 3600) : 0;
    }
    return freq;
  }, [customHours, freq]);

  const perRun = useMemo(() => parseDecimalInput(amountInput, unitDec), [amountInput, unitDec]);
  const total = perRun ? dcaTotal(perRun, Math.max(0, runCount)) : 0n;

  // Price guard: ceiling for buys (below now), floor for sells (above now). 0 = none.
  const guardPrice = guardPct !== 0 && cur != null ? movePrice(cur, guardPct) : null;

  const estPerRun = useMemo(() => {
    if (!perRun || !cur) return 0n;
    return expectedAmountOut(isSell ? "LIMIT_SELL" : "LIMIT_BUY", perRun, cur, stockDec, quoteDec);
  }, [perRun, cur, isSell, stockDec, quoteDec]);

  const error = useMemo(() => {
    if (!market) return "Pick a market that supports orders.";
    if (isSell) {
      return validateDcaSell({ amountPerSell: perRun, sells: runCount, intervalSec: intervalSec || 0, minPrice: guardPrice, balance, maxStockIn: cap });
    }
    return validateDca({ amountPerBuy: perRun, buys: runCount, intervalSec: intervalSec || 0, maxPrice: guardPrice, balance, maxQuoteIn: cap });
  }, [market, isSell, perRun, runCount, intervalSec, guardPrice, balance, cap]);

  const schedule = planSchedule(nowSec, runCount, intervalSec || 3600);
  const needsApproval = total > 0n && allowance < total;
  const blocked = paused || regionRestricted || !market?.enabled;

  // Spread the whole (capped) balance across the chosen number of runs
  const spreadBalance = () => {
    if (runCount < 1 || balance <= 0n) return;
    const usable = balance > cap ? cap : balance;
    setAmountInput(formatUnits(usable / BigInt(runCount), unitDec));
  };

  const submit = async () => {
    if (error || !perRun || !market) return;
    const stockToken = market.stockToken as Address;
    if (holdFirst && !(await limitOrders.holdNewPlans())) return;
    const hash = isSell
      ? await createDcaSell({ stockToken, amountPerSell: perRun, sells: runCount, interval: intervalSec, minPrice: guardPrice ?? 0n })
      : await createDca({ stockToken, amountPerBuy: perRun, buys: runCount, interval: intervalSec, maxPrice: guardPrice ?? 0n });
    if (hash) setAmountInput("");
  };

  const when = intervalSec ? FREQUENCIES.find((f) => f.seconds === intervalSec)?.label.toLowerCase() ?? `every ${Math.round(intervalSec / 3600)}h` : "";
  const summary =
    perRun && runCount > 0 && intervalSec
      ? isSell
        ? `Sell ${fmt(perRun, stockDec)} ${sym} ${when}, ${runCount} times over ${formatDuration(schedule.durationSec)} (${fmt(total, stockDec)} ${sym} in total).${guardPrice ? ` Skips a sale while the price is under $${formatPrice(priceNum(guardPrice) ?? 0)}.` : ""} At today's price each sale pays about ${fmt(estPerRun, quoteDec)} ${quoteSym}.`
        : `Buy ${fmt(perRun, quoteDec)} ${quoteSym} of ${sym} ${when}, ${runCount} times over ${formatDuration(schedule.durationSec)} (${fmt(total, quoteDec)} ${quoteSym} in total).${guardPrice ? ` Skips a buy while the price is over $${formatPrice(priceNum(guardPrice) ?? 0)}.` : ""} At today's price each buy gets about ${fmt(estPerRun, stockDec)} ${sym}.`
      : null;

  const presets = isSell ? GUARD_PRESETS_SELL : GUARD_PRESETS_BUY;

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-card sm:p-5">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold text-[var(--ink)]">
            <CalendarClock size={17} className="text-[var(--brand-text)]" /> Auto-trade on a schedule
          </h3>
          <p className="text-xs text-[var(--ink-muted)]">Build a position gradually, or take profit in steps. Cancel any time and get the unused part back.</p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1" role="group" aria-label="Plan side">
          {(["buy", "sell"] as const).map((sd) => (
            <button
              key={sd}
              type="button"
              aria-pressed={side === sd}
              onClick={() => setSide(sd)}
              className={`min-h-[40px] rounded-lg text-sm font-bold transition ${side === sd ? (sd === "buy" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {sd === "buy" ? "Auto-buy" : "Auto-sell"}
            </button>
          ))}
        </div>

        {/* Amount per run */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="rec-amount" className="font-semibold text-[var(--ink)]">{isSell ? `${sym} to sell each time` : `${quoteSym} to spend each time`}</label>
            <span className="text-[var(--ink-muted)]">Balance {fmt(balance, unitDec)} {unitSym}</span>
          </div>
          <div className="relative">
            <input
              id="rec-amount"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              className="h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3.5 pr-16 font-mono text-base text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ink-muted)]">{unitSym}</span>
          </div>
          <button type="button" onClick={spreadBalance} className="text-[11px] font-semibold text-[var(--brand-text)] hover:underline">
            Spread my balance over {runCount || "…"} runs
          </button>
        </div>

        {/* How many + how often */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--ink)]">How many times</span>
          <div className="flex gap-1">
            {RUN_PRESETS.map((n) => (
              <button key={n} type="button" aria-pressed={customRuns === "" && runs === n} onClick={() => { setRuns(n); setCustomRuns(""); }} className={`min-h-[36px] flex-1 rounded-lg text-xs font-bold ${customRuns === "" && runs === n ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                {n}
              </button>
            ))}
            <input aria-label="Custom number of runs" inputMode="numeric" value={customRuns} onChange={(e) => setCustomRuns(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Other" className="h-9 w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-center text-base sm:text-xs text-[var(--ink)] outline-none focus:border-[var(--brand-text)]" />
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[var(--ink)]">How often</span>
          <div className="flex flex-wrap gap-1">
            {FREQUENCIES.map((f) => (
              <button key={f.seconds} type="button" aria-pressed={customHours === "" && freq === f.seconds} onClick={() => { setFreq(f.seconds); setCustomHours(""); }} className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold ${customHours === "" && freq === f.seconds ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                {f.label}
              </button>
            ))}
            <input aria-label="Custom hours between runs" inputMode="decimal" value={customHours} onChange={(e) => setCustomHours(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Hours" className="h-[34px] w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-center text-base sm:text-xs text-[var(--ink)] outline-none focus:border-[var(--brand-text)]" />
          </div>
        </div>

        {/* Price guard */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--ink)]">{isSell ? "Only sell at or above" : "Only buy at or below"}</span>
            <span className="text-[var(--ink-muted)]">Now ${curNum != null ? formatPrice(curNum) : "—"}</span>
          </div>
          <div className="flex gap-1">
            {presets.map((p) => (
              <button key={p} type="button" aria-pressed={guardPct === p} onClick={() => setGuardPct(p)} className={`min-h-[34px] flex-1 rounded-lg text-xs font-bold ${guardPct === p ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                {p === 0 ? "Any price" : `${p > 0 ? "+" : ""}${p}%`}
              </button>
            ))}
          </div>
          {guardPrice != null && curNum != null && (
            <p className="text-[11px] text-[var(--ink-muted)]">
              {isSell ? "Floor" : "Ceiling"} <b className="text-[var(--ink)]">${formatPrice(priceNum(guardPrice) ?? 0)}</b> ({(distancePct(curNum, priceNum(guardPrice) ?? 0) ?? 0).toFixed(1)}% from now). Runs that miss it wait for the next window.
            </p>
          )}
        </div>

        {summary && (
          <div className="space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs">
            <p className="leading-relaxed text-[var(--ink)]">{summary}</p>
            <p className="text-[var(--ink-muted)]">First run right away, last on {new Date(schedule.lastRun * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.</p>
          </div>
        )}

        {isSell && perRun && curNum != null && total > 0n && (
          <p className="text-[11px] text-[var(--ink-muted)]">Selling is a taxable event in many places. This is not tax advice.</p>
        )}

        {market && total > 0n && cap > 0n && total > cap && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-500">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>The plan total is above this market&apos;s limit of {fmt(cap, unitDec)} {unitSym}. Use fewer or smaller runs.</span>
          </div>
        )}

        <ul className="space-y-1 text-[11px] text-[var(--ink-muted)]" aria-label="Safety">
          {[
            "The full amount is held by the order contract, never by us. Cancel to get the unused part back.",
            "Each run is checked against the Chainlink price and skipped if the pool price is too far off.",
            `Execution fee ${(limitOrders.keeperFeeBps / 100).toFixed(2)}% per run, only when a run happens.`,
          ].map((t) => (
            <li key={t} className="flex gap-1.5"><ShieldCheck size={13} className="mt-px shrink-0 text-emerald-500" />{t}</li>
          ))}
        </ul>

        {walletAddress && !blocked && <HoldFirstBuyToggle checked={holdFirst} onChange={setHoldFirst} disabled={txSubmitting} />}

        {!walletAddress ? (
          <button type="button" onClick={onConnectWallet} className="min-h-[48px] w-full rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)]">Connect wallet</button>
        ) : blocked ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-muted)]"><Lock size={14} /> New plans are unavailable right now. You can still cancel existing ones.</div>
        ) : needsApproval && !error ? (
          <button type="button" disabled={txSubmitting} onClick={() => approveToken(isSell ? (market!.stockToken as Address) : config.quoteToken.address, total, unitSym)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50">
            {txSubmitting && <Loader2 size={16} className="animate-spin" />} Step 1 of 2: Allow {fmt(total, unitDec)} {unitSym}
          </button>
        ) : (
          <button type="button" disabled={Boolean(error) || txSubmitting} onClick={() => void submit()} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white hover:bg-[var(--brand-hover)] disabled:pointer-events-none disabled:opacity-50">
            {txSubmitting ? <><Loader2 size={16} className="animate-spin" /> Confirm in your wallet…</> : error ? error : isSell ? "Start auto-sell" : "Start auto-buy"}
          </button>
        )}

        {txSuccessHash && (
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-500">
            <CheckCircle2 size={14} /> Plan started. Track it below.
          </div>
        )}
      </div>

      <MyPlansPanel plans={plans} markets={marketStates} quoteSymbol={quoteSym} quoteDecimals={quoteDec} onCancelPlan={cancelDca} isSubmitting={txSubmitting} rulesCtx={walletAddress ? { chainId: limitOrders.chainId, orderBook: limitOrders.config.orderBook, owner: walletAddress, sign: limitOrders.signMessage } : null} />
    </div>
  );
}
