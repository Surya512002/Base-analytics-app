"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { AlertTriangle, CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { parseDecimalInput } from "@/src/lib/limitOrders/orderMath";
import {
  MAX_BASKET_STOCKS,
  ceilingFromPct,
  composeBasketPlan,
  equalWeights,
  keeperFeeUsd,
  normalizeWeights,
  type ComposerStock,
} from "@/src/lib/limitOrders/planComposer";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { getOrdersConfigError } from "@/src/config/limitOrders";
import MyPlansPanel from "./MyPlansPanel";

const FREQUENCIES = [
  { label: "Daily", seconds: 86_400, word: "day" },
  { label: "Weekly", seconds: 604_800, word: "week" },
  { label: "Every 2 weeks", seconds: 1_209_600, word: "2 weeks" },
  { label: "Monthly", seconds: 2_592_000, word: "30 days" },
] as const;

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fromUnits = (v: bigint) => Number(formatUnits(v, 6));
const mixKey = (wallet: string) => `stock_portfolio_targets_v1_${wallet.toLowerCase()}`;

type Row = { stockToken: `0x${string}`; weight: string };

function durationText(seconds: number): string {
  const days = Math.round(seconds / 86_400);
  if (days < 1) return "under a day";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  return `about ${Math.round(days / 30)} months`;
}

/**
 * Invest in several stocks over time with one plan: pick the stocks and weights, a budget, how many
 * buys and how often. It starts one ordinary on-chain recurring buy per stock, so every limit, fee and
 * safety rule is the contract's own. Works with every wallet: one USDC approval, then one confirmation
 * per stock. If a step fails it stops, keeps what was created, and lets you continue.
 */
export default function InvestPlanComposer({
  limitOrders,
  onConnectWallet,
}: {
  limitOrders: ReturnType<typeof useLimitOrders>;
  onConnectWallet?: () => void;
}) {
  const { config, chainId, walletAddress, paused, regionRestricted, marketStates, plans, keeperFeeBps, quoteBalance, quoteAllowance, txSubmitting, approveToken, createDca, cancelDca } = limitOrders;

  const stockMarkets = useMemo(() => config.markets.filter((m) => (m.kind ?? "stock") === "stock"), [config.markets]);
  const [rows, setRows] = useState<Row[]>([]);
  const [budget, setBudget] = useState("");
  const [buysInput, setBuysInput] = useState("12");
  const [freq, setFreq] = useState<number>(604_800);
  const [ceilingPct, setCeilingPct] = useState("");
  const [created, setCreated] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const locked = created.length > 0;
  const configError = getOrdersConfigError(config, chainId);

  const stocks: ComposerStock[] = rows.flatMap((r) => {
    const m = stockMarkets.find((x) => x.stockToken.toLowerCase() === r.stockToken.toLowerCase());
    const st = marketStates[r.stockToken.toLowerCase()];
    if (!m || !st) return [];
    return [{ symbol: m.symbol, stockToken: r.stockToken, weightPct: Number(r.weight), maxQuoteIn: st.maxQuoteIn }];
  });

  const budgetUnits = parseDecimalInput(budget, 6) ?? 0n;
  const buys = Number(buysInput);
  const rowsKey = JSON.stringify(rows);
  const composed = useMemo(
    () => composeBasketPlan({ stocks, budget: budgetUnits, buys, intervalSec: freq, balance: quoteBalance }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowsKey, budgetUnits, buys, freq, quoteBalance, marketStates]
  );

  const remaining = composed.ok ? composed.plan.legs.filter((l) => !created.includes(l.symbol)) : [];
  const remainingTotal = remaining.reduce((a, l) => a + l.total, 0n);
  const needsApproval = remainingTotal > quoteAllowance;
  const ceilingNum = ceilingPct.trim() === "" ? null : Number(ceilingPct);
  const ceilingError = ceilingNum !== null && (!Number.isFinite(ceilingNum) || ceilingNum < 0 || ceilingNum > 1000) ? "Enter a percent from 0 to 1000, or leave it blank." : null;

  const setWeights = (w: number[]) => setRows((r) => r.map((row, i) => ({ ...row, weight: String(w[i] ?? 0) })));
  const addStock = (addr: string) => {
    if (!addr || rows.length >= MAX_BASKET_STOCKS) return;
    const next = [...rows, { stockToken: addr as `0x${string}`, weight: "0" }];
    setRows(next.map((row, i) => ({ ...row, weight: String(equalWeights(next.length)[i]) })));
  };
  const loadMix = () => {
    if (!walletAddress) return;
    try {
      const raw = JSON.parse(localStorage.getItem(mixKey(walletAddress)) ?? "null") as Record<string, number> | null;
      if (!raw) return setMessage("No saved target mix yet. Set one in Lend & Stake → My Stocks.");
      const picked = Object.entries(raw)
        .flatMap(([symbol, w]) => {
          const m = stockMarkets.find((x) => x.symbol === symbol);
          return m && typeof w === "number" ? [{ token: m.stockToken, w }] : [];
        })
        .sort((a, b) => b.w - a.w)
        .slice(0, MAX_BASKET_STOCKS);
      if (picked.length === 0) return setMessage("None of the stocks in your saved mix can be bought with plans yet.");
      const w = normalizeWeights(picked.map((p) => p.w));
      setRows(picked.map((p, i) => ({ stockToken: p.token as `0x${string}`, weight: String(w[i]) })));
      setMessage(picked.length < Object.keys(raw).length ? "Some stocks in your mix can't be bought with plans yet, so the others were scaled up to fill 100%." : null);
    } catch {
      setMessage("Couldn't read your saved mix.");
    }
  };

  const approve = async () => {
    if (remainingTotal <= 0n) return;
    await approveToken(config.quoteToken.address, remainingTotal, config.quoteToken.symbol);
  };

  const start = async () => {
    if (!composed.ok || running || ceilingError) return;
    setConfirming(false);
    setRunning(true);
    setMessage(null);
    const done: string[] = [...created];
    try {
      for (const leg of composed.plan.legs) {
        if (done.includes(leg.symbol)) continue;
        const st = marketStates[leg.stockToken.toLowerCase()];
        const maxPrice = ceilingNum !== null ? ceilingFromPct(st?.currentPrice ?? null, ceilingNum) : 0n;
        if (ceilingNum !== null && maxPrice === null) {
          setMessage(`${leg.symbol}: its price isn't available right now, so a price limit can't be set. Clear the limit or try again.`);
          break;
        }
        const hash = await createDca({ stockToken: leg.stockToken, amountPerBuy: leg.amountPerBuy, buys: leg.buys, interval: freq, maxPrice: maxPrice ?? 0n });
        if (!hash) {
          setMessage(`Stopped at ${leg.symbol}. ${done.length} of ${composed.plan.legs.length} plans were created and are running. Nothing else was started. Press the button again to continue with the rest.`);
          break;
        }
        done.push(leg.symbol);
        setCreated([...done]);
      }
      if (composed.ok && composed.plan.legs.every((l) => done.includes(l.symbol))) {
        setMessage(`All ${done.length} plans are running. The first buy of each happens on the next keeper run, then every ${FREQUENCIES.find((f) => f.seconds === freq)?.word ?? "interval"}.`);
      }
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setCreated([]);
    setMessage(null);
    setConfirming(false);
  };

  if (!walletAddress) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center">
        <h3 className="text-base font-bold text-[var(--ink)]">Invest in several stocks over time</h3>
        <p className="mx-auto max-w-sm text-xs text-[var(--ink-muted)]">Connect a wallet to build a plan.</p>
        {onConnectWallet && (
          <button type="button" onClick={onConnectWallet} className="min-h-[44px] rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white">
            Connect wallet
          </button>
        )}
      </div>
    );
  }

  if (configError) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-[var(--ink)]">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>{configError}</span>
      </div>
    );
  }

  const unused = stockMarkets.filter((m) => !rows.some((r) => r.stockToken.toLowerCase() === m.stockToken.toLowerCase()));
  const blocked = paused || regionRestricted;
  const field = "min-h-[40px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-sm font-bold text-[var(--ink)] outline-none";

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-[var(--ink)]">
          <CalendarClock size={15} /> Invest in several stocks over time
        </h3>
        <p className="text-xs text-[var(--ink-muted)]">
          One recurring buy per stock, started together. Your USDC for each plan is held by the order-book contract until each buy runs. You can cancel any plan and get the unspent USDC back. Buys only run while the stock price feed is fresh, so nothing runs on weekends.
        </p>
      </div>

      {paused && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">Orders are paused right now. You can still cancel plans.</p>}
      {regionRestricted && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">These orders aren&apos;t available in your region. You can still cancel existing plans.</p>}

      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">Stocks and shares</h4>
          <div className="flex gap-1.5">
            <button type="button" disabled={locked || rows.length === 0} onClick={() => setWeights(equalWeights(rows.length))} className="min-h-[32px] rounded-full border border-[var(--border-subtle)] px-3 text-[11px] font-bold text-[var(--ink-muted)] disabled:opacity-40">
              Equal split
            </button>
            <button type="button" disabled={locked} onClick={loadMix} className="min-h-[32px] rounded-full border border-[var(--border-subtle)] px-3 text-[11px] font-bold text-[var(--ink-muted)] disabled:opacity-40">
              Use my target mix
            </button>
          </div>
        </div>
        <ul className="space-y-1.5">
          {rows.map((r, i) => {
            const m = stockMarkets.find((x) => x.stockToken.toLowerCase() === r.stockToken.toLowerCase());
            const leg = composed.ok ? composed.plan.legs.find((l) => l.symbol === m?.symbol) : null;
            return (
              <li key={r.stockToken} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[72px] text-sm font-black text-[var(--ink)]">{m?.symbol}</span>
                <input
                  aria-label={`${m?.symbol} share in percent`}
                  inputMode="decimal"
                  disabled={locked}
                  value={r.weight}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, weight: e.target.value.replace(/[^0-9.]/g, "").slice(0, 6) } : x)))}
                  className={`${field} w-20 text-center`}
                />
                <span className="text-xs text-[var(--ink-muted)]">%</span>
                {leg && (
                  <span className="text-[11px] text-[var(--ink-muted)]">
                    {usd(fromUnits(leg.amountPerBuy))} each buy · {usd(fromUnits(leg.total))} total{created.includes(leg.symbol) ? " · started" : ""}
                  </span>
                )}
                <button type="button" aria-label={`Remove ${m?.symbol}`} disabled={locked} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:text-red-500 disabled:opacity-40">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
        {rows.length < MAX_BASKET_STOCKS && !locked && (
          <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <Plus size={13} />
            <select aria-label="Add a stock" value="" onChange={(e) => addStock(e.target.value)} className={`${field} flex-1 text-xs`}>
              <option value="">Add a stock…</option>
              {unused.map((m) => (
                <option key={m.stockToken} value={m.stockToken}>
                  {m.symbol} — {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-bold text-[var(--ink-soft)]">
          Total budget (USDC)
          <input inputMode="decimal" disabled={locked} value={budget} placeholder="100" onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, "").slice(0, 10))} className={`${field} w-full`} />
          <span className="block text-[11px] font-normal text-[var(--ink-muted)]">Wallet: {usd(fromUnits(quoteBalance))}</span>
        </label>
        <label className="space-y-1 text-xs font-bold text-[var(--ink-soft)]">
          Number of buys (1 to 365)
          <input inputMode="numeric" disabled={locked} value={buysInput} onChange={(e) => setBuysInput(e.target.value.replace(/\D/g, "").slice(0, 3))} className={`${field} w-full`} />
        </label>
        <div className="space-y-1 sm:col-span-2">
          <span className="text-xs font-bold text-[var(--ink-soft)]">How often</span>
          <div role="radiogroup" aria-label="How often" className="flex flex-wrap gap-1.5">
            {FREQUENCIES.map((f) => (
              <button key={f.seconds} type="button" role="radio" aria-checked={freq === f.seconds} disabled={locked} onClick={() => setFreq(f.seconds)} className={`min-h-[36px] rounded-full border px-3.5 text-xs font-bold disabled:opacity-60 ${freq === f.seconds ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)]"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-1 text-xs font-bold text-[var(--ink-soft)] sm:col-span-2">
          Optional: skip buys while a price is more than this % above today&apos;s price
          <input inputMode="decimal" disabled={locked} value={ceilingPct} placeholder="no limit" onChange={(e) => setCeilingPct(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} className={`${field} w-32`} />
          <span className="block text-[11px] font-normal text-[var(--ink-muted)]">Fixed in dollars when you start (today&apos;s price plus this %). If a stock rises past it, its buys wait, they are not lost.</span>
          {ceilingError && <span role="alert" className="block text-[11px] font-semibold text-amber-600">{ceilingError}</span>}
        </label>
      </div>

      {rows.length > 0 && budgetUnits > 0n && (
        composed.ok ? (
          <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-xs text-[var(--ink-muted)]">
            <p className="text-sm font-black text-[var(--ink)]">
              {usd(fromUnits(composed.plan.totalCommitted))} across {composed.plan.legs.length} stock{composed.plan.legs.length === 1 ? "" : "s"}
            </p>
            <p>
              {buys} buy{buys === 1 ? "" : "s"} each, one every {FREQUENCIES.find((f) => f.seconds === freq)?.word}, over {durationText(composed.plan.durationSec)}. The first buy runs right away.
            </p>
            <p>
              Keeper fee about {usd(keeperFeeUsd(composed.plan.totalCommitted, keeperFeeBps))} in total ({(keeperFeeBps / 100).toFixed(2)}% of what is bought), plus the pool&apos;s own trading fee and price impact on each buy.
            </p>
            {composed.plan.unspent > 0n && <p>{usd(fromUnits(composed.plan.unspent))} of rounding stays in your wallet.</p>}
            {composed.plan.warnings.map((w) => (
              <p key={w} className="font-semibold text-amber-600 dark:text-amber-300">{w}</p>
            ))}
            <p>Spreading a lump sum over time usually does not earn more than investing it at once (Vanguard found lump sum ahead in about two thirds of periods). It does smooth out the price you pay. Prices can fall.</p>
          </div>
        ) : (
          <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {composed.error}
          </p>
        )
      )}

      {message && <p role="status" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">{message}</p>}

      {composed.ok && remaining.length > 0 && !blocked && (
        <div className="space-y-2">
          {needsApproval ? (
            <button type="button" disabled={txSubmitting || running} onClick={() => void approve()} className="min-h-[46px] w-full rounded-xl bg-[var(--brand)] text-sm font-bold text-white disabled:opacity-50">
              {txSubmitting ? "Confirm in your wallet…" : `Step 1: approve ${usd(fromUnits(remainingTotal))} USDC`}
            </button>
          ) : confirming ? (
            <div role="alertdialog" aria-label="Confirm plans" className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-bold text-[var(--ink)]">
                This starts {remaining.length} plan{remaining.length === 1 ? "" : "s"} and moves {usd(fromUnits(remainingTotal))} USDC into the order-book contract. Your wallet asks you to confirm each one.
              </p>
              <p className="text-[11px] text-[var(--ink-muted)]">If one fails, it stops. The plans already started keep running and the rest are not started.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void start()} className="min-h-[40px] flex-1 rounded-xl bg-[var(--brand)] text-sm font-bold text-white">Confirm and start</button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-[40px] rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold text-[var(--ink-soft)]">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={running || !!ceilingError} onClick={() => setConfirming(true)} className="min-h-[46px] w-full rounded-xl bg-[var(--brand)] text-sm font-bold text-white disabled:opacity-50">
              {created.length > 0 ? `Continue: start the other ${remaining.length}` : `Start ${remaining.length} plan${remaining.length === 1 ? "" : "s"}`}
            </button>
          )}
          {running && (
            <p role="status" className="flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
              <Loader2 size={14} className="animate-spin" /> Starting plans… confirm each one in your wallet.
            </p>
          )}
        </div>
      )}
      {created.length > 0 && !running && (
        <button type="button" onClick={reset} className="text-xs font-bold text-[var(--ink-muted)] underline">Start a new basket plan</button>
      )}

      <MyPlansPanel plans={plans} markets={marketStates} quoteSymbol={config.quoteToken.symbol} quoteDecimals={config.quoteToken.decimals} onCancelPlan={cancelDca} isSubmitting={txSubmitting} rulesCtx={walletAddress ? { chainId, orderBook: config.orderBook, owner: walletAddress, sign: limitOrders.signMessage } : null} />
    </div>
  );
}
