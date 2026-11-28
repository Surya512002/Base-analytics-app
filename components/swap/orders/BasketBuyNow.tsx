"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { AlertTriangle, CalendarClock, Check, Loader2, Plus, ShoppingBasket, X } from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import StockRiskModal from "@/components/compliance/StockRiskModal";
import { useCompliance } from "@/hooks/useCompliance";
import { signedPct, useStockReturns } from "@/hooks/useStockReturns";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { basketLegs, BASKETS, MIN_PER_LEG } from "@/components/stocks/basket-math";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { equalTargets, mixReturnPct } from "@/lib/stocks/portfolio-math";
import { STOCK_DECIMALS, useBasketQuotes, useUsdcBalance } from "@/hooks/useBasketQuotes";

export const MAX_BUY_STOCKS = 10;
const AMOUNTS = [10, 25, 50, 100];
const SLIPPAGES = [0.5, 1, 3];

const STOCKS = new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s]));
const PRESETS = BASKETS.map((b) => ({ ...b, symbols: b.symbols.filter((s) => STOCKS.has(s)) })).filter((b) => b.symbols.length >= 2);

const card = "space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5";
const chip = (on: boolean) =>
  `min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-bold transition ${
    on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--brand)]"
  }`;

/**
 * Split an amount of USDC across several stocks and buy them all now, in one step. As often as the
 * person likes; the repeating version is the basket plan on the next switch.
 */
export default function BasketBuyNow({ app, onConnectWallet, onRepeat }: { app: WalletAppState; onConnectWallet?: () => void; onRepeat?: () => void }) {
  const wallet = app.wallet?.address ?? null;
  const [symbols, setSymbols] = useState<string[]>(PRESETS[0]?.symbols ?? []);
  const [total, setTotal] = useState("25");
  const [slippage, setSlippage] = useState(0.5);
  const [accepted, setAccepted] = useState(false);
  const [bought, setBought] = useState(0);
  const [tick, setTick] = useState(0);
  const compliance = useCompliance();

  const totalNum = Number(total);
  const split = useMemo(() => {
    if (symbols.length === 0) return { items: [], error: "Pick at least one stock." };
    // One stock is allowed here; the shared splitter expects a basket of two or more.
    if (symbols.length === 1)
      return totalNum >= MIN_PER_LEG
        ? { items: [{ symbol: symbols[0]!, amount: totalNum.toFixed(2) }] }
        : { items: [], error: `Use at least $${MIN_PER_LEG}.` };
    return basketLegs(symbols, totalNum);
  }, [symbols, totalNum]);
  const { rows, quoting, noRoute, failed, critical, risky, key } = useBasketQuotes(split.items, slippage, tick);
  useEffect(() => setAccepted(false), [key]);
  const balance = useUsdcBalance(wallet, bought);

  const returns = useStockReturns(symbols);
  const history = useMemo(() => {
    if (symbols.length === 0) return [];
    const targets = equalTargets(symbols);
    return ([30, 90] as const).map((d) => ({ d, ...mixReturnPct(targets, Object.fromEntries(Object.entries(returns).map(([k, v]) => [k, v?.[d]]))) }));
  }, [symbols, returns]);

  const short = balance !== null && totalNum > balance;

  const blocked = split.error
    ? split.error
    : quoting
      ? "Getting prices…"
      : failed.length
        ? "Couldn't get prices. Retrying…"
        : noRoute.length
          ? `Remove ${noRoute.map((r) => r.symbol).join(", ")} to continue`
        : critical.length
          ? `Price impact too high on ${critical.map((r) => r.symbol).join(", ")}`
          : short
            ? "Not enough USDC"
            : risky.length && !accepted
              ? "Accept the price impact below"
              : null;

  const toggle = (symbol: string) =>
    setSymbols((s) => (s.includes(symbol) ? s.filter((x) => x !== symbol) : s.length >= MAX_BUY_STOCKS ? s : [...s, symbol]));

  const buy = async () => {
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
    if (ok) {
      setBought((n) => n + 1);
      setTick((n) => n + 1);
    }
  };

  const onBuy = () => {
    if (!wallet) return onConnectWallet?.();
    compliance.guardStockAction("enter", () => void buy(), (reason) => app.showToast(reason, ""));
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <section aria-labelledby="basket-pick" className={card}>
        <h2 id="basket-pick" className="flex items-center gap-2 text-[17px] font-bold text-[var(--ink)]">
          <ShoppingBasket size={20} aria-hidden className="text-[var(--brand-text)]" /> Split your USDC across stocks
        </h2>

        <div role="group" aria-label="Ready-made baskets" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={p.symbols.join() === symbols.join()} onClick={() => setSymbols(p.symbols.slice(0, MAX_BUY_STOCKS))} className={chip(p.symbols.join() === symbols.join())}>
              {p.title}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Chosen stocks">
          {symbols.map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)} aria-label={`Remove ${s}`} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] pl-1.5 pr-3 text-sm font-bold text-[var(--ink)] hover:border-[var(--brand)]">
              <TokenLogo address={STOCKS.get(s)?.address} symbol={s} size={28} />
              {s}
              <X size={14} aria-hidden className="text-[var(--ink-muted)]" />
            </button>
          ))}
          <label className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[var(--edge)] px-3 text-sm font-bold text-[var(--brand-text)]">
            <Plus size={15} aria-hidden />
            <span className="sr-only">Add a stock</span>
            <select
              value=""
              onChange={(e) => e.target.value && toggle(e.target.value)}
              disabled={symbols.length >= MAX_BUY_STOCKS}
              className="max-w-40 cursor-pointer bg-transparent font-bold outline-none"
            >
              <option value="">{symbols.length >= MAX_BUY_STOCKS ? `${MAX_BUY_STOCKS} is the most` : "Add a stock"}</option>
              {BASE_OFFICIAL_STOCKS.filter((s) => !symbols.includes(s.symbol)).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} · {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="basket-total" className="text-sm font-bold text-[var(--ink)]">Total (USDC)</label>
          <input
            id="basket-total"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*?)\./g, "$1").slice(0, 8))}
            className="min-h-11 w-28 rounded-2xl border border-[var(--edge)] bg-[var(--surface-2)] px-3 text-center text-lg font-black text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          />
          {AMOUNTS.map((a) => (
            <button key={a} type="button" aria-pressed={total === String(a)} onClick={() => setTotal(String(a))} className={chip(total === String(a))}>
              ${a}
            </button>
          ))}
        </div>
        {balance !== null && <p className="text-[13px] text-[var(--ink-muted)]">You have ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC.</p>}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[var(--ink)]">Slippage</span>
          {SLIPPAGES.map((v) => (
            <button key={v} type="button" aria-pressed={slippage === v} onClick={() => setSlippage(v)} className={chip(slippage === v)}>
              {v}%
            </button>
          ))}
        </div>

        {history.some((r) => r.returnPct !== null) && (
          <p className="flex flex-wrap gap-x-4 text-[13px] font-bold">
            {history.map((r) =>
              r.returnPct === null ? null : (
                <span key={r.d} className={r.returnPct >= 0 ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"}>
                  {r.d}d {signedPct(r.returnPct)}
                  <span className="font-normal text-[var(--ink-muted)]"> (DEX prices, {Math.round(r.covered)}% of basket)</span>
                </span>
              )
            )}
          </p>
        )}
      </section>

      <section aria-labelledby="basket-review" className={card}>
        <h2 id="basket-review" className="text-[17px] font-bold text-[var(--ink)]">What you get</h2>
        {split.error ? (
          <p role="alert" className="text-sm text-[var(--ink-muted)]">{split.error}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r) => (
              <li key={r.symbol} className="flex min-h-14 items-center gap-3 py-2">
                <TokenLogo address={STOCKS.get(r.symbol)?.address} symbol={r.symbol} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[var(--ink)]">{r.symbol}</span>
                  <span className="block truncate text-[13px] text-[var(--ink-muted)]">${r.amount}</span>
                </span>
                <span className="text-right text-[13px] tabular-nums">
                  {!r.q ? (
                    <Loader2 size={16} aria-label="Getting price" className="animate-spin text-[var(--brand-text)]" />
                  ) : !r.q.hasLiquidity ? (
                    <span className="font-bold text-[var(--danger-text)]">{r.q.failed ? "No price yet" : "No route"}</span>
                  ) : (
                    <>
                      <span className="block text-[15px] font-bold text-[var(--ink)]">≈ {Number(formatUnits(BigInt(r.q.amountOut), STOCK_DECIMALS)).toLocaleString("en-US", { maximumSignificantDigits: 5 })}</span>
                      <span className={r.impact && r.impact.tier !== "safe" ? "font-bold text-[var(--danger-text)]" : "text-[var(--ink-muted)]"}>
                        {r.impact ? r.impact.badgeLabel : "Impact unknown"}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {noRoute.length > 0 && (
          <button
            type="button"
            onClick={() => setSymbols((s) => s.filter((x) => !noRoute.some((r) => r.symbol === x)))}
            className="min-h-11 w-full cursor-pointer rounded-2xl border border-[var(--brand)] text-sm font-bold text-[var(--brand-text)]"
          >
            Remove stocks with no route and split again
          </button>
        )}

        {risky.length > 0 && (
          <label className="flex items-start gap-2 rounded-2xl border border-[var(--danger-text)] p-3 text-[13px] font-bold text-[var(--ink)]">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            <span>
              <AlertTriangle size={14} aria-hidden className="mr-1 inline" />
              I accept the high price impact on {risky.map((r) => r.symbol).join(", ")}.
            </span>
          </label>
        )}

        <button
          type="button"
          onClick={onBuy}
          disabled={Boolean(wallet) && (Boolean(blocked) || app.swapLoading)}
          className="btn-primary flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {app.swapLoading && <Loader2 size={17} aria-hidden className="animate-spin" />}
          {!wallet
            ? "Connect wallet to buy"
            : app.swapLoading
              ? "Confirm in your wallet…"
              : blocked ?? `Buy ${rows.length} stock${rows.length === 1 ? "" : "s"} for $${totalNum.toFixed(2)}`}
        </button>
        {bought > 0 && (
          <p role="status" className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--success-text)]">
            <Check size={15} aria-hidden /> Bought. You can buy again any time.
          </p>
        )}
        <p className="text-[13px] text-[var(--ink-muted)]">
          0.25% fee. All stocks are bought together or not at all. Smart wallets confirm once; browser wallets such as MetaMask confirm twice (an approval, then the purchase). Some stocks aren&apos;t available in every region. Not investment advice.
        </p>
        {onRepeat && (
          <button type="button" onClick={onRepeat} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--edge)] text-sm font-bold text-[var(--ink)] hover:border-[var(--brand)]">
            <CalendarClock size={16} aria-hidden /> Repeat automatically instead
          </button>
        )}
      </section>

      <StockRiskModal isOpen={compliance.modalOpen} onClose={compliance.closeModal} onAcknowledge={compliance.acknowledge} issuerTermsUrl={compliance.status.issuerTermsUrl} />
    </div>
  );
}
