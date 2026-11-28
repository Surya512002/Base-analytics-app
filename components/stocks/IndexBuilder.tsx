"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { AlertTriangle, Check, Info, Layers, Loader2, Plus, X } from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import StockRiskModal from "@/components/compliance/StockRiskModal";
import ShareCount from "@/components/stocks/ShareCount";
import { BASKETS } from "@/components/stocks/basket-math";
import { useCompliance } from "@/hooks/useCompliance";
import { STOCK_DECIMALS, useBasketQuotes, useUsdcBalance } from "@/hooks/useBasketQuotes";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { MY_STOCKS_HREF } from "@/lib/constants/destinations";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { COINBASE_LIQUID_STOCKS } from "@/lib/stocks/live-stocks.generated";
import {
  DEFAULT_INDEX_RULES,
  MAX_INDEX_STOCKS,
  cashKept,
  checkIndex,
  fitWeights,
  indexLegs,
  parseRules,
  pickStocks,
  rulesKey,
  targetsFromIndex,
  targetsKey,
  type IndexIssue,
} from "@/lib/stocks/index-builder";

const STOCKS = new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s]));
const BY_ADDRESS = new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.address.toLowerCase(), s.symbol]));
/** Official stocks with real Base liquidity, deepest first. */
const DEEPEST = COINBASE_LIQUID_STOCKS.map((a) => BY_ADDRESS.get(a)).filter((s): s is string => Boolean(s));
const THEMES = BASKETS.map((b) => ({ id: b.id, title: b.title, symbols: b.symbols.filter((s) => STOCKS.has(s)) })).filter((b) => b.symbols.length >= 2);
const STARTS = [{ id: "deepest", title: "Deepest markets", symbols: DEEPEST }, ...THEMES];
const DEEPEST_COUNT = 8;
const AMOUNTS = [25, 50, 100, 250];
const SLIPPAGES = [0.5, 1, 3];

const card = "space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5";
const chip = (on: boolean) =>
  `min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-bold transition ${
    on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--brand)]"
  }`;
const field = "min-h-11 rounded-2xl border border-[var(--edge)] bg-[var(--surface-2)] px-2 text-center font-black text-[var(--ink)] outline-none focus:border-[var(--brand)]";
const outline = "min-h-11 cursor-pointer rounded-2xl border border-[var(--edge)] px-4 text-sm font-bold text-[var(--ink)] hover:border-[var(--brand)]";
const decimal = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*?)\./g, "$1").slice(0, 8);
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

const startingStocks = (startId: string, excluded: Set<string>) =>
  pickStocks((STARTS.find((s) => s.id === startId) ?? STARTS[0]!).symbols, excluded, startId === "deepest" ? DEEPEST_COUNT : MAX_INDEX_STOCKS);
const excludedBy = (themes: string[], removed: string[]) =>
  new Set([...removed, ...THEMES.filter((t) => themes.includes(t.id)).flatMap((t) => t.symbols)]);

/**
 * Your own stock index: say what you want in it and your limits, see why it can't be bought if it
 * can't, then approve one purchase. The saved mix is what Holdings later rebalances against.
 */
export default function IndexBuilder({ app, onConnectWallet }: { app: WalletAppState; onConnectWallet?: () => void }) {
  const wallet = app.wallet?.address ?? null;
  const compliance = useCompliance();
  const [start, setStart] = useState("deepest");
  const [leftOutThemes, setLeftOutThemes] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>(() => startingStocks("deepest", new Set()));
  /** Weights the person typed; null means "split evenly within my rules". */
  const [custom, setCustom] = useState<Record<string, string> | null>(null);
  const [maxPct, setMaxPct] = useState(String(DEFAULT_INDEX_RULES.maxPct));
  const [cashPct, setCashPct] = useState(String(DEFAULT_INDEX_RULES.cashPct));
  const [total, setTotal] = useState("100");
  const [slippage, setSlippage] = useState(0.5);
  const [accepted, setAccepted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [done, setDone] = useState<"bought" | "saved" | null>(null);
  const [tick, setTick] = useState(0);

  const rules = useMemo(() => ({ maxPct: num(maxPct), cashPct: num(cashPct) }), [maxPct, cashPct]);
  const rulesUsable = parseRules(JSON.stringify(rules)) !== null;
  const weights = useMemo<Record<string, number>>(() => {
    if (custom) return Object.fromEntries(symbols.map((s) => [s, num(custom[s] ?? "")]));
    return rulesUsable ? fitWeights(Object.fromEntries(symbols.map((s) => [s, 1])), rules) : Object.fromEntries(symbols.map((s) => [s, 0]));
  }, [custom, symbols, rules, rulesUsable]);

  const totalNum = num(total);
  const restricted = compliance.status.locationBlocked;
  const legs = useMemo(() => (restricted ? [] : indexLegs(weights, totalNum)), [restricted, weights, totalNum]);
  const { rows, quoting, noRoute, failed, critical, risky, key } = useBasketQuotes(legs, slippage, tick);
  const balance = useUsdcBalance(wallet, tick);
  const spend = legs.reduce((s, l) => s + Number(l.amount), 0);
  const cash = cashKept(legs, totalNum);
  const invested = Object.values(weights).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);

  useEffect(() => {
    setAccepted(false);
    setReviewing(false);
  }, [key]);

  const issues: IndexIssue[] = useMemo(() => {
    if (!rulesUsable) return [{ id: "rules", level: "block", text: "Set a company limit from 1% to 100% and cash from 0% to 99%." }];
    return checkIndex({ weights, rules, totalUsd: totalNum, unavailable: noRoute.map((r) => r.symbol) });
  }, [rulesUsable, weights, rules, totalNum, noRoute]);
  const extra: IndexIssue[] = [
    ...(failed.length ? [{ id: "prices", level: "block" as const, text: `Couldn't get a price for ${failed.map((r) => r.symbol).join(", ")}. Trying again.` }] : []),
    ...(critical.length ? [{ id: "impact", level: "block" as const, text: `Price impact is too high on ${critical.map((r) => r.symbol).join(", ")}. Use a smaller amount or take it out.` }] : []),
    ...(balance !== null && spend > balance ? [{ id: "balance", level: "block" as const, text: `You have ${money(balance)} USDC; this needs ${money(spend)}.` }] : []),
  ];
  const all = [...issues, ...extra];
  const blockers = all.filter((i) => i.level === "block");
  const ready = !restricted && blockers.length === 0 && !quoting && rows.length > 0 && (risky.length === 0 || accepted);
  const overRules = all.some((i) => i.id === "cash" || i.id.startsWith("limit-"));

  const choose = (nextStart: string, themes: string[], gone: string[]) => {
    setStart(nextStart);
    setLeftOutThemes(themes);
    setRemoved(gone);
    setSymbols(startingStocks(nextStart, excludedBy(themes, gone)));
    setCustom(null);
    setDone(null);
  };
  const remove = (symbol: string) => {
    setSymbols((s) => s.filter((x) => x !== symbol));
    setRemoved((r) => [...r, symbol]);
    setDone(null);
  };
  const add = (symbol: string) => {
    setSymbols((s) => (s.includes(symbol) || s.length >= MAX_INDEX_STOCKS ? s : [...s, symbol]));
    setRemoved((r) => r.filter((x) => x !== symbol));
    setCustom(null);
    setDone(null);
  };
  const type = (symbol: string, value: string) => {
    setCustom((c) => ({ ...(c ?? Object.fromEntries(symbols.map((s) => [s, String(weights[s] ?? 0)]))), [symbol]: decimal(value) }));
    setDone(null);
  };
  const fit = () => setCustom(Object.fromEntries(Object.entries(fitWeights(weights, rules)).map(([s, n]) => [s, String(n)])));

  /** Remember the mix and its limits so Holdings can rebalance against them. */
  const save = (owner: string) => {
    try {
      localStorage.setItem(targetsKey(owner), JSON.stringify(targetsFromIndex(weights)));
      localStorage.setItem(rulesKey(owner), JSON.stringify({ maxPct: rules.maxPct, cashPct: Math.max(0, Math.round((100 - invested) * 100) / 100) }));
      return true;
    } catch {
      return false;
    }
  };

  const buy = async () => {
    if (!wallet) return;
    const ok = await app.handleBasketBuy({
      slippageBps: slippage * 100,
      legs: rows.map((r) => ({
        symbol: r.symbol,
        token: STOCKS.get(r.symbol)!.address,
        decimals: STOCK_DECIMALS,
        usdc: r.amount,
        // Nothing is sent if a fresh quote pays less than the minimum shown here.
        floorOut: BigInt(r.q!.amountOutMinimum),
      })),
    });
    if (!ok) return;
    setReviewing(false);
    setDone(save(wallet) ? "bought" : null);
    setTick((n) => n + 1);
  };
  const approve = () => {
    if (!wallet) return onConnectWallet?.();
    compliance.guardStockAction("enter", () => void buy(), (reason) => app.showToast(reason, ""));
  };

  // A mix can be saved without buying, as long as the mix itself obeys the rules.
  const savable = issues.every((i) => i.level !== "block" || i.id === "amount" || i.id.startsWith("unavailable-"));
  const rowBySymbol = new Map(rows.map((r) => [r.symbol, r]));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <section aria-labelledby="index-pick" className={card}>
        <h2 id="index-pick" className="flex items-center gap-2 text-[17px] font-bold text-[var(--ink)]">
          <Layers size={20} aria-hidden className="text-[var(--brand-text)]" /> Build your own index
        </h2>

        <p className="text-sm font-bold text-[var(--ink)]">Start with</p>
        <div role="group" aria-label="Start with" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STARTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={start === s.id} onClick={() => choose(s.id, leftOutThemes, removed)} className={chip(start === s.id)}>
              {s.title}
            </button>
          ))}
        </div>

        <p className="text-sm font-bold text-[var(--ink)]">Leave out</p>
        <div role="group" aria-label="Leave out" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {THEMES.map((t) => {
            const on = leftOutThemes.includes(t.id);
            return (
              <button key={t.id} type="button" aria-pressed={on} title={t.symbols.join(", ")} onClick={() => choose(start, on ? leftOutThemes.filter((x) => x !== t.id) : [...leftOutThemes, t.id], removed)} className={chip(on)}>
                {t.title}
              </button>
            );
          })}
        </div>
        {removed.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--ink-muted)]">
            <span>You left out:</span>
            {removed.map((s) => (
              <button key={s} type="button" onClick={() => add(s)} aria-label={`Put ${s} back`} className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-[var(--edge)] px-3 font-bold text-[var(--ink)]">
                <Plus size={13} aria-hidden /> {s}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm font-bold text-[var(--ink)]">Your rules</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[13px] text-[var(--ink-muted)]">
            Most per company (%)
            <input inputMode="decimal" value={maxPct} onChange={(e) => setMaxPct(decimal(e.target.value))} className={`${field} mt-1 w-full`} />
          </label>
          <label className="block text-[13px] text-[var(--ink-muted)]">
            Keep as cash (%)
            <input inputMode="decimal" value={cashPct} onChange={(e) => setCashPct(decimal(e.target.value))} className={`${field} mt-1 w-full`} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="index-total" className="text-sm font-bold text-[var(--ink)]">Index value (USDC)</label>
          <input id="index-total" inputMode="decimal" value={total} onChange={(e) => setTotal(decimal(e.target.value))} className={`${field} w-28 text-lg`} />
          {AMOUNTS.map((a) => (
            <button key={a} type="button" aria-pressed={total === String(a)} onClick={() => setTotal(String(a))} className={chip(total === String(a))}>
              ${a}
            </button>
          ))}
        </div>
        {balance !== null && <p className="text-[13px] text-[var(--ink-muted)]">You have {money(balance)} USDC.</p>}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[var(--ink)]">Slippage</span>
          {SLIPPAGES.map((v) => (
            <button key={v} type="button" aria-pressed={slippage === v} onClick={() => setSlippage(v)} className={chip(slippage === v)}>
              {v}%
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="index-review" className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="index-review" className="text-[17px] font-bold text-[var(--ink)]">Your index</h2>
          {custom && (
            <button type="button" onClick={() => setCustom(null)} className="min-h-9 cursor-pointer text-[13px] font-bold text-[var(--brand-text)]">
              Split evenly
            </button>
          )}
        </div>

        <ul className="divide-y divide-[var(--border-subtle)]">
          {symbols.map((s) => {
            const r = rowBySymbol.get(s);
            const tokens = r?.q?.hasLiquidity ? Number(formatUnits(BigInt(r.q.amountOut), STOCK_DECIMALS)) : 0;
            const bad = all.some((i) => i.level === "block" && i.symbol === s);
            return (
              <li key={s} className="flex min-h-16 flex-wrap items-center gap-x-2 py-2 sm:flex-nowrap">
                <TokenLogo address={STOCKS.get(s)?.address} symbol={s} size={34} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-bold ${bad ? "text-[var(--danger-text)]" : "text-[var(--ink)]"}`}>{s}</span>
                  <span className="block truncate text-[13px] text-[var(--ink-muted)]">{r ? money(Number(r.amount)) : STOCKS.get(s)?.name}</span>
                </span>
                {/* On a phone the estimate gets its own line under the row. */}
                <span className="order-last flex basis-full flex-wrap gap-x-2 pl-[42px] text-[13px] tabular-nums text-[var(--ink-muted)] sm:order-none sm:block sm:basis-auto sm:pl-0 sm:text-right">
                  {!r ? null : !r.q ? (
                    <Loader2 size={15} aria-label="Getting price" className="animate-spin text-[var(--brand-text)]" />
                  ) : !r.q.hasLiquidity ? (
                    <span className="font-bold text-[var(--danger-text)]">{r.q.failed ? "No price yet" : "Unavailable"}</span>
                  ) : (
                    <>
                      <span className="block font-bold text-[var(--ink)]">≈ {tokens.toLocaleString("en-US", { maximumSignificantDigits: 4 })} {tokens === 1 ? "token" : "tokens"}</span>
                      {r.impact && r.impact.tier !== "safe" ? (
                        <span className="block font-bold text-[var(--danger-text)]">{r.impact.badgeLabel}</span>
                      ) : (
                        <ShareCount token={STOCKS.get(s)?.address} tokens={tokens} className="block" />
                      )}
                    </>
                  )}
                </span>
                <label className="flex shrink-0 items-center gap-1 text-[13px] text-[var(--ink-muted)]">
                  <span className="sr-only">{s} weight in percent</span>
                  <input inputMode="decimal" value={custom ? (custom[s] ?? "") : String(weights[s] ?? 0)} onChange={(e) => type(s, e.target.value)} className={`${field} w-16 text-sm`} />
                  <span aria-hidden>%</span>
                </label>
                <button type="button" onClick={() => remove(s)} aria-label={`Leave out ${s}`} className="grid h-11 w-8 shrink-0 cursor-pointer place-items-center text-[var(--ink-muted)] hover:text-[var(--danger-text)]">
                  <X size={15} aria-hidden />
                </button>
              </li>
            );
          })}
          <li className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px] font-bold text-[var(--ink)]">
            <span>Cash (USDC) you keep</span>
            <span className="tabular-nums">
              {rulesUsable && invested <= 100 ? `${Number((100 - invested).toFixed(2))}%` : "—"}
              {legs.length > 0 && invested <= 100 ? ` · ${money(cash)}` : ""}
            </span>
          </li>
        </ul>

        {symbols.length < MAX_INDEX_STOCKS && (
          <label className="flex min-h-11 items-center gap-2 rounded-full border border-dashed border-[var(--edge)] px-3 text-sm font-bold text-[var(--brand-text)]">
            <Plus size={15} aria-hidden />
            <span className="sr-only">Add a stock to the index</span>
            <select value="" onChange={(e) => e.target.value && add(e.target.value)} className="min-w-0 flex-1 cursor-pointer bg-transparent font-bold outline-none">
              <option value="">Add a stock</option>
              {BASE_OFFICIAL_STOCKS.filter((s) => !symbols.includes(s.symbol)).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} · {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {restricted && (
          <p role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] font-bold text-[var(--ink)]">
            Tokenized stock features are not available in your region.
          </p>
        )}
        {all.length > 0 && (
          <ul aria-label="Index warnings" aria-live="polite" className="space-y-1.5">
            {all.map((i) => (
              <li key={i.id} className={`flex items-start gap-2 rounded-2xl border p-3 text-[13px] font-bold text-[var(--ink)] ${i.level === "block" ? "border-[var(--danger-text)]" : "border-amber-500/40 bg-amber-500/10"}`}>
                {i.level === "block" ? <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-[var(--danger-text)]" /> : <Info size={15} aria-hidden className="mt-0.5 shrink-0" />}
                <span className="flex-1">{i.text}</span>
                {i.id.startsWith("unavailable-") && i.symbol && (
                  <button type="button" onClick={() => remove(i.symbol!)} className="min-h-9 shrink-0 cursor-pointer rounded-full border border-[var(--brand)] px-3 text-[var(--brand-text)]">
                    Take it out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {overRules && (
          <button type="button" onClick={fit} className="min-h-11 w-full cursor-pointer rounded-2xl border border-[var(--brand)] text-sm font-bold text-[var(--brand-text)]">
            Fit the weights to my rules
          </button>
        )}

        {risky.length > 0 && (
          <label className="flex items-start gap-2 rounded-2xl border border-[var(--danger-text)] p-3 text-[13px] font-bold text-[var(--ink)]">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            <span>I accept the high price impact on {risky.map((r) => r.symbol).join(", ")}.</span>
          </label>
        )}

        {reviewing && ready ? (
          <div role="group" aria-label="Approve this purchase" className="space-y-2 rounded-2xl border border-[var(--brand)] p-3">
            <p className="text-sm font-black text-[var(--ink)]">Approve this purchase</p>
            <ul className="space-y-0.5 text-[13px] tabular-nums text-[var(--ink)]">
              {rows.map((r) => (
                <li key={r.symbol} className="flex justify-between gap-3">
                  <span>Buy {r.symbol}</span>
                  <span>{money(Number(r.amount))}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 font-bold">
                <span>Spend {money(spend)}</span>
                <span>Keep {money(cash)}</span>
              </li>
            </ul>
            <p className="text-[13px] text-[var(--ink-muted)]">
              0.25% fee included. Up to {slippage}% slippage. All stocks are bought together or not at all. Nothing happens until you confirm in your wallet.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={approve} disabled={app.swapLoading} className="btn-primary flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl text-[15px] font-bold disabled:opacity-50">
                {app.swapLoading && <Loader2 size={17} aria-hidden className="animate-spin" />}
                {app.swapLoading ? "Confirm in your wallet…" : wallet ? "Approve and buy" : "Connect wallet to buy"}
              </button>
              <button type="button" onClick={() => setReviewing(false)} className={outline}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setReviewing(true)} disabled={!ready} className="btn-primary flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl px-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-50">
            {restricted ? "Not available in your region" : blockers.length ? "Fix the warnings to continue" : quoting ? "Getting prices…" : risky.length && !accepted ? "Accept the price impact above" : "Review the purchase"}
          </button>
        )}

        {wallet && !restricted && (
          <button type="button" onClick={() => setDone(save(wallet) ? "saved" : null)} disabled={!savable} className={`${outline} w-full disabled:cursor-not-allowed disabled:opacity-50`}>
            Save as my index without buying
          </button>
        )}
        {done && (
          <p role="status" className="flex items-start gap-1.5 text-[13px] font-bold text-[var(--success-text)]">
            <Check size={15} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              {done === "bought" ? "Bought and saved." : "Saved."}{" "}
              <Link href={MY_STOCKS_HREF} className="underline">
                See drift and rebalance in Holdings
              </Link>
            </span>
          </p>
        )}
        <p className="text-[13px] text-[var(--ink-muted)]">
          Some stocks aren&apos;t available in every region. Your index is saved in this browser only. Not investment advice.
        </p>
      </section>

      <StockRiskModal isOpen={compliance.modalOpen} onClose={compliance.closeModal} onAcknowledge={compliance.acknowledge} issuerTermsUrl={compliance.status.issuerTermsUrl} />
    </div>
  );
}
