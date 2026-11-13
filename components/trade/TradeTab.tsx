"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSwitchChain } from "wagmi";
import { base } from "viem/chains";
import { ChevronDown, Loader2, Search, Star, TrendingDown, TrendingUp } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { TradeMarket } from "@/app/api/trade/markets/route";
import DexSwapCard from "@/components/swap/DexSwapCard";
import OrdersView from "@/components/swap/orders/OrdersView";
import RecurringView from "@/components/swap/orders/RecurringView";
import MyOrdersPanel from "@/components/swap/orders/MyOrdersPanel";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";
import { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";
import { PRICE_DECIMALS } from "@/src/lib/limitOrders/orderMath";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import { useWatchlist } from "@/lib/trade/watchlist";
import CandleChart, { formatPrice, type Candle, type ChartType, type Indicators, type PriceLine } from "./CandleChart";
import { AlertButton, MarketInfo, Position, RecentTrades, type MarketStats } from "./TradePanels";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
type Kind = "all" | "stocks" | "coins";
type Ticket = "market" | "orders" | "recurring";

type MarketSummary = {
  priceUsd: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
};

function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(n);
}

function ChangePill({ pct }: { pct: number | null | undefined }) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-[var(--ink-muted)]">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

function MarketPicker({
  open,
  onClose,
  onPick,
  selected,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: TradeMarket) => void;
  selected?: string;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [rows, setRows] = useState<TradeMarket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/trade/markets?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const d = (await r.json()) as { markets?: TradeMarket[] };
        setRows(d.markets ?? []);
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => {
      clearTimeout(handle);
      ctrl.abort();
    };
  }, [open, q, kind]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,420px)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-card">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coins & stocks (NVDA, ETH, 0x…)"
            aria-label="Search markets"
            className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] pl-9 pr-3 text-base sm:text-sm text-[var(--ink)] outline-none focus:border-[#0052FF]"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {(["all", "stocks", "coins"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${kind === k ? "bg-[#0052FF] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="mt-2 max-h-[340px] overflow-y-auto">
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-8 text-[var(--ink-muted)]"><Loader2 className="animate-spin" size={18} /></div>
          )}
          {!loading && rows.length === 0 && <p className="py-6 text-center text-sm text-[var(--ink-muted)]">No markets found</p>}
          {rows.map((m) => (
            <button
              key={`${m.kind}-${m.address}`}
              type="button"
              onClick={() => {
                onPick(m);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--surface-2)] ${selected?.toLowerCase() === m.address.toLowerCase() ? "bg-[var(--surface-2)]" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.iconUrl ? <img src={m.iconUrl} alt="" className="h-7 w-7 rounded-full" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold">{m.symbol.slice(0, 2)}</span>}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                  {m.symbol}
                  <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${m.kind === "stock" ? "bg-blue-500/10 text-blue-600" : "bg-[var(--surface-2)] text-[var(--ink-muted)]"}`}>{m.kind}</span>
                </span>
                <span className="block truncate text-[11px] text-[var(--ink-muted)]">{m.name}</span>
              </span>
              <span className="text-right text-xs tabular-nums">
                <span className="block font-semibold text-[var(--ink)]">{m.priceUsd != null ? `$${formatPrice(m.priceUsd)}` : "—"}</span>
                <ChangePill pct={m.change24h} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function TradeTab({
  app,
  guestMode = false,
  onRequestConnect,
}: {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
}) {
  const searchParams = useSearchParams();
  const { switchChain } = useSwitchChain();
  const limitOrders = useLimitOrders(app);
  const ordersEnabled = isLimitOrdersFeatureEnabled();

  const [market, setMarket] = useState<TradeMarket | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tf, setTf] = useState<Timeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartNote, setChartNote] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket>("market");
  const [swapPick, setSwapPick] = useState<SwapCounter | null>(null);
  const [pickedPrice, setPickedPrice] = useState<{ price: string; nonce: number } | null>(null);
  const nonce = useRef(0);
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [indicators, setIndicators] = useState<Indicators>({ ma: false, ema: false, boll: false, rsi: false });
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [pool, setPool] = useState<string | null>(null);
  const watchlist = useWatchlist();
  const holdingsState = useWalletHoldings(app.wallet?.address, market ? [market.address] : []);
  const holding = holdingsState.allTokens.find((t) => t.address?.toLowerCase() === market?.address.toLowerCase());

  // Initial market: ?token=0x… (or ?buy=) else the most-traded tokenized stock
  useEffect(() => {
    let cancelled = false;
    const wanted = (searchParams?.get("token") ?? searchParams?.get("buy") ?? "").trim();
    (async () => {
      try {
        if (/^0x[0-9a-fA-F]{40}$/.test(wanted)) {
          const res = await resolveSwapToken(wanted);
          if (!cancelled && res.counter && res.counter.kind === "token") {
            setMarket({ kind: "coin", address: res.counter.address, symbol: res.counter.symbol, name: res.counter.name ?? res.counter.symbol, priceUsd: null, change24h: null, volume24hUsd: null });
            return;
          }
        }
        const r = await fetch("/api/trade/markets?kind=stocks");
        const d = (await r.json()) as { markets?: TradeMarket[] };
        const first = d.markets?.find((m) => limitOrders.config.markets.some((c) => c.stockToken.toLowerCase() === m.address.toLowerCase())) ?? d.markets?.[0];
        if (!cancelled && first) setMarket(first);
        else if (!cancelled) {
          const c = await fetch("/api/trade/markets?kind=coins").then((x) => x.json() as Promise<{ markets?: TradeMarket[] }>);
          if (c.markets?.[0]) setMarket(c.markets[0]);
        }
      } catch {
        /* picker still usable */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chart feed, refreshed every 20s
  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    const load = async (initial: boolean) => {
      if (initial) {
        setChartLoading(true);
        setCandles([]);
      }
      try {
        const r = await fetch(`/api/trade/candles?address=${market.address}&tf=${tf}`);
        const d = (await r.json()) as { candles?: Candle[]; summary?: MarketSummary; stats?: MarketStats; pool?: string | null; note?: string; error?: string };
        if (cancelled) return;
        setCandles(d.candles ?? []);
        if (d.summary) setSummary(d.summary);
        setStats(d.stats ?? null);
        setPool(d.pool ?? null);
        setChartNote(d.error ?? d.note ?? null);
      } catch {
        if (!cancelled) setChartNote("Chart data unavailable");
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    };
    void load(true);
    const id = setInterval(() => void load(false), 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [market, tf]);

  // Prefill the market-swap card with the selected asset
  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    void resolveSwapToken(market.address).then((res) => {
      if (cancelled || !res.counter) return;
      const verified = isVerifiedBaseToken(res.counter);
      setSwapPick({ ...res.counter, isVerified: verified, isUnverified: verified ? false : Boolean(res.counter.isUnverified) });
    });
    return () => {
      cancelled = true;
    };
  }, [market]);

  const orderMarket = useMemo(
    () => limitOrders.config.markets.find((m) => m.stockToken.toLowerCase() === market?.address.toLowerCase()),
    [limitOrders.config.markets, market?.address]
  );
  const canPlaceOrders = ordersEnabled && !!orderMarket;

  useEffect(() => {
    if (ticket === "orders" && !ordersEnabled) setTicket("market");
  }, [ticket, ordersEnabled]);

  const orderLines = useMemo<PriceLine[]>(() => {
    if (!orderMarket) return [];
    const lines: PriceLine[] = [];
    const px = (v: bigint) => Number(v) / 10 ** PRICE_DECIMALS;
    const forMarket = (a: string) => a.toLowerCase() === orderMarket.stockToken.toLowerCase();
    for (const item of limitOrders.openOrders) {
      if (item.kind === "bracket") {
        if (!forMarket(item.takeProfitLeg.stockToken)) continue;
        lines.push({ price: px(item.takeProfitLeg.triggerPrice), label: "TP", tone: "sell" });
        lines.push({ price: px(item.stopLossLeg.triggerPrice), label: "SL", tone: "stop" });
      } else {
        if (!forMarket(item.order.stockToken)) continue;
        const tone = item.orderKind === "LIMIT_BUY" ? "buy" : item.orderKind === "LIMIT_SELL" ? "sell" : "stop";
        const label = item.orderKind === "LIMIT_BUY" ? "Buy" : item.orderKind === "LIMIT_SELL" ? "TP" : item.orderKind === "TRAILING_STOP" ? "Trail" : "Stop";
        lines.push({ price: px(item.order.triggerPrice), label, tone });
      }
    }
    return lines;
  }, [limitOrders.openOrders, orderMarket]);

  const handleSwitchBase = useCallback(() => {
    try {
      switchChain?.({ chainId: base.id });
    } catch {
      /* wallet may reject */
    }
  }, [switchChain]);

  const lastClose = candles.length ? candles[candles.length - 1].c : null;
  const price = lastClose ?? summary?.priceUsd ?? market?.priceUsd ?? null;
  const change = summary?.priceChange24h ?? market?.change24h ?? null;
  const intraday = tf !== "1d";

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-1 sm:px-2">
      {/* Market bar */}
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-card">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-[var(--surface-2)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {market?.iconUrl && <img src={market.iconUrl} alt="" className="h-8 w-8 rounded-full" />}
            <span className="text-left">
              <span className="block text-base font-extrabold leading-tight text-[var(--ink)]">{market ? `${market.symbol} / USD` : "Select market"}</span>
              <span className="block max-w-[200px] truncate text-[11px] text-[var(--ink-muted)]">{market?.name ?? "Coins & tokenized stocks"}</span>
            </span>
            <ChevronDown size={16} className="text-[var(--ink-muted)]" />
          </button>
          <MarketPicker open={pickerOpen} onClose={() => setPickerOpen(false)} selected={market?.address} onPick={(m) => { setMarket(m); setPickedPrice(null); }} />
        </div>

        <div>
          <div className="text-xl font-extrabold tabular-nums text-[var(--ink)]">{price != null ? `$${formatPrice(price)}` : "—"}</div>
          <div className="text-xs"><ChangePill pct={change} /> <span className="text-[var(--ink-muted)]">24h</span></div>
        </div>
        {market && (
          <div className="flex items-center gap-0.5 sm:order-last sm:ml-auto">
            <button
              type="button"
              aria-label={watchlist.has(market.address) ? "Remove from watchlist" : "Add to watchlist"}
              aria-pressed={watchlist.has(market.address)}
              onClick={() => watchlist.toggle(market)}
              className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[var(--surface-2)]"
            >
              <Star size={17} className={watchlist.has(market.address) ? "fill-amber-400 text-amber-400" : "text-[var(--ink-muted)]"} />
            </button>
            <AlertButton wallet={app.wallet?.address} address={market.address} symbol={market.symbol} price={price} onToast={(m) => app.showToast(m, "")} />
          </div>
        )}
        <dl className="flex gap-5 text-xs">
          <div><dt className="text-[var(--ink-muted)]">24h volume</dt><dd className="font-semibold tabular-nums text-[var(--ink)]">{compactUsd(summary?.volume24h ?? market?.volume24hUsd)}</dd></div>
          <div><dt className="text-[var(--ink-muted)]">Liquidity</dt><dd className="font-semibold tabular-nums text-[var(--ink)]">{compactUsd(summary?.liquidityUsd)}</dd></div>
          <div className="hidden sm:block"><dt className="text-[var(--ink-muted)]">Market cap</dt><dd className="font-semibold tabular-nums text-[var(--ink)]">{compactUsd(summary?.marketCap)}</dd></div>
        </dl>
      </div>

      {watchlist.items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5" aria-label="Watchlist">
          {watchlist.items.map((w) => (
            <button
              key={w.address}
              type="button"
              onClick={() => { setMarket({ ...w, priceUsd: null, change24h: null, volume24hUsd: null }); setPickedPrice(null); }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${market?.address.toLowerCase() === w.address.toLowerCase() ? "border-[#0052FF] bg-[#0052FF]/10 text-[var(--ink)]" : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              <Star size={11} className="fill-amber-400 text-amber-400" />
              {w.symbol}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Chart + orders */}
        <div className="min-w-0 space-y-3">
          <section aria-label="Price chart" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2 sm:p-3 shadow-card">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex gap-1" role="tablist" aria-label="Timeframe">
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tf === t}
                    onClick={() => setTf(t)}
                    className={`min-h-[32px] rounded-lg px-2.5 text-xs font-semibold ${tf === t ? "bg-[var(--ink)] text-[var(--surface)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <div className="flex rounded-lg bg-[var(--surface-2)] p-0.5" role="group" aria-label="Chart type">
                  {(["candles", "line"] as const).map((ct) => (
                    <button key={ct} type="button" aria-pressed={chartType === ct} onClick={() => setChartType(ct)} className={`min-h-[28px] rounded-md px-2 text-[11px] font-semibold capitalize ${chartType === ct ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs" : "text-[var(--ink-muted)]"}`}>{ct}</button>
                  ))}
                </div>
                {([["ma", "MA"], ["ema", "EMA"], ["boll", "BOLL"], ["rsi", "RSI"]] as const).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={indicators[k]} onClick={() => setIndicators((v) => ({ ...v, [k]: !v[k] }))} className={`min-h-[28px] rounded-md px-2 text-[11px] font-semibold ${indicators[k] ? "bg-[#0052FF] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="relative">
              {chartLoading && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--surface)]/60"><Loader2 className="animate-spin text-[var(--ink-muted)]" /></div>
              )}
              <CandleChart
                candles={candles}
                chartType={chartType}
                indicators={indicators}
                intraday={intraday}
                lines={orderLines}
                height={400}
                onPickPrice={
                  ticket === "orders" && canPlaceOrders
                    ? (p) => {
                        nonce.current += 1;
                        setPickedPrice({ price: p.toFixed(p >= 1 ? 2 : 6), nonce: nonce.current });
                      }
                    : undefined
                }
              />
            </div>
            {chartNote && <p className="px-2 pb-1 text-[11px] text-[var(--ink-muted)]">{chartNote}</p>}
            {ticket === "orders" && canPlaceOrders && <p className="px-2 pt-1 text-[11px] text-[var(--ink-muted)]">Click the chart to set your order price</p>}
            <p className="px-2 pt-1 text-[10px] text-[var(--ink-muted)]">Prices from on-chain DEX pools on Base (GeckoTerminal / DexScreener). Tokenized stocks trade 24/7 on-chain and may differ from the exchange price.</p>
          </section>

          {market && (
            <div className="grid gap-3 md:grid-cols-2">
              <MarketInfo stats={stats} symbol={market.symbol} />
              <RecentTrades pool={pool} token={market.address} symbol={market.symbol} />
            </div>
          )}

          {ordersEnabled && (
            <section aria-label="Open orders">
              <MyOrdersPanel
                openOrders={limitOrders.openOrders}
                historyOrders={limitOrders.historyOrders}
                markets={limitOrders.marketStates}
                quoteSymbol={limitOrders.config.quoteToken.symbol}
                quoteDecimals={limitOrders.config.quoteToken.decimals}
                onCancelOrder={limitOrders.cancelOrder}
                onRefundExpired={limitOrders.refundExpired}
                onUpdateOrder={limitOrders.updateOrder}
                isSubmitting={limitOrders.txSubmitting}
              />
            </section>
          )}
        </div>

        {/* Ticket */}
        <aside className="min-w-0 space-y-3" aria-label="Order ticket">
          {market && <Position holding={holding} price={price} symbol={market.symbol} />}
          <div className={`grid gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 ${ordersEnabled ? "grid-cols-3" : "grid-cols-1"}`} role="tablist">
            {(
              [
                ["market", "Market"],
                ["orders", "Limit / Stop"],
                ["recurring", "Recurring"],
              ] as const
            )
              .filter(([id]) => id === "market" || ordersEnabled)
              .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={ticket === id}
                  onClick={() => setTicket(id)}
                  className={`min-h-[40px] rounded-lg text-sm font-semibold ${ticket === id ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs" : "text-[var(--ink-muted)]"}`}
                >
                  {label}
                </button>
              ))}
          </div>

          {ticket === "market" && (
            <DexSwapCard
              app={app}
              guestMode={guestMode}
              onRequestConnect={onRequestConnect}
              prefillReceiveCounter={swapPick}
              onPrefillReceiveApplied={() => setSwapPick(null)}
            />
          )}

          {ticket === "orders" && ordersEnabled && (
            <>
              {!canPlaceOrders && market && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--ink-muted)]">
                  Limit, stop-loss, trailing-stop and OCO orders run on the on-chain order book, which supports these markets on this network:
                  {" "}{limitOrders.config.markets.map((m) => m.symbol).join(", ") || "none"}. <b className="text-[var(--ink)]">{market.symbol}</b> can still be traded at market from the Market tab.
                </div>
              )}
              <OrdersView
                limitOrders={limitOrders}
                onConnectWallet={onRequestConnect}
                onSwitchChain={handleSwitchBase}
                selectedStockAddress={orderMarket?.stockToken}
                onStockChange={(addr) => {
                  const m = limitOrders.config.markets.find((x) => x.stockToken.toLowerCase() === addr.toLowerCase());
                  if (m) setMarket({ kind: "stock", address: m.stockToken, symbol: m.symbol, name: m.name, priceUsd: null, change24h: null, volume24hUsd: null, iconUrl: m.logo, decimals: m.decimals });
                }}
                priceFromChart={pickedPrice}
                hideOrdersPanel
                cexLayout
              />
            </>
          )}

          {ticket === "recurring" && ordersEnabled && (
            <RecurringView
              limitOrders={limitOrders}
              onConnectWallet={onRequestConnect}
              onSwitchChain={handleSwitchBase}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
