"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSwitchChain } from "wagmi";
import { base } from "viem/chains";
import { ChevronDown, Loader2, Maximize2, Minimize2, Search, Star, TrendingDown, TrendingUp } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { TradeMarket } from "@/app/api/trade/markets/route";
import DexSwapCard from "@/components/swap/DexSwapCard";
import OrdersView from "@/components/swap/orders/OrdersView";
import Link from "next/link";
import RecurringCard from "./RecurringCard";
import MyOrdersPanel from "@/components/swap/orders/MyOrdersPanel";
import { TradeTabs } from "@/components/shell/PlaceTabs";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";
import { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";
import { PRICE_DECIMALS } from "@/src/lib/limitOrders/orderMath";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import { useWatchlist } from "@/lib/trade/watchlist";
import { formatUnits } from "viem";
import { oracleHealth } from "@/lib/trade/safety";
import { chartToOrderPrice } from "@/src/lib/limitOrders/priceBasis";
import CandleChart, { formatPrice, type Candle, type ChartType, type Indicators, type PriceLine } from "./CandleChart";
import { AlertButton, MarketInfo, Position, RecentTrades, type MarketStats } from "./TradePanels";
import MarketRail from "./MarketRail";
import OrderBookPanel from "./OrderBookPanel";
import { AUTO_INVEST_HREF } from "@/lib/constants/destinations";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
type Kind = "all" | "stocks" | "coins";
type Ticket = "market" | "limit" | "stop" | "recurring";
type BottomTab = "orders" | "book" | "trades" | "info" | "balance";

type MarketSummary = {
  priceUsd: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
};

// Selling defaults to USDC, like the quote currency on an exchange.
const USDC_COUNTER: SwapCounter = { kind: "token", address: USDC_BASE, symbol: "USDC", name: "USD Coin", decimals: 6, isVerified: true, isUnverified: false };

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
            className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] pl-9 pr-3 text-base sm:text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {(["all", "stocks", "coins"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${kind === k ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
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
  // Deep links from stock cards: /trade?token=0x…&ticket=recurring (auto-invest) or &ticket=orders&goal=stop-loss
  const goalParam = searchParams?.get("goal");
  const initialGoal = (["buy-dip", "take-profit", "stop-loss", "protect"] as const).find((g) => g === goalParam);
  const ticketParam = searchParams?.get("ticket");
  const [ticket, setTicket] = useState<Ticket>(
    ticketParam === "recurring"
      ? "recurring"
      : ticketParam === "orders"
        ? initialGoal === "stop-loss" || initialGoal === "protect"
          ? "stop"
          : "limit"
        : "market"
  );
  // Arriving from a menu switch while this screen is already open.
  const lastTicketParam = useRef(ticketParam);
  useEffect(() => {
    if (lastTicketParam.current === ticketParam) return;
    lastTicketParam.current = ticketParam;
    setTicket(ticketParam === "recurring" ? "recurring" : ticketParam === "orders" ? "limit" : "market");
  }, [ticketParam]);
  const [side, setSide] = useState<"buy" | "sell">(
    ticket === "stop" || initialGoal === "take-profit" || initialGoal === "protect" ? "sell" : "buy"
  );
  const [bottomTab, setBottomTab] = useState<BottomTab>("orders");
  const [fullscreen, setFullscreen] = useState(false);
  const ticketRef = useRef<HTMLElement | null>(null);
  const [orderMode, setOrderMode] = useState<"simple" | "scale" | "pro">("simple");
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10_000);
    return () => clearInterval(t);
  }, []);
  const [swapPick, setSwapPick] = useState<SwapCounter | null>(null);
  const [pickedPrice, setPickedPrice] = useState<{ price: string; nonce: number; note?: { chartPrice: number; gapPct: number; suspect: boolean } } | null>(null);
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
  const orderMarketState = orderMarket ? limitOrders.marketStates[orderMarket.stockToken.toLowerCase()] : undefined;
  const feed = orderMarketState && orderMarket ? oracleHealth(orderMarketState.updatedAt, orderMarket.maxStalenessSeconds, nowSec) : null;

  useEffect(() => {
    if (ticket !== "market" && !ordersEnabled) setTicket("market");
  }, [ticket, ordersEnabled]);

  // Esc leaves the full-screen chart
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Shorter chart on phones so the ticket is a short scroll away
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // The swap card only applies a "pay with" token that arrives after it mounted, so hand it over one render later.
  const [sellPrefill, setSellPrefill] = useState<SwapCounter | null>(null);
  useEffect(() => {
    setSellPrefill(side === "sell" && ticket === "market" ? swapPick : null);
  }, [side, ticket, swapPick, market?.address]);

  const onOrderTab = ticket === "limit" || ticket === "stop";
  const pickSide = (next: "buy" | "sell") => {
    setSide(next);
    if (next === "buy" && ticket === "stop") setTicket("limit"); // a stop-loss only sells
  };
  const orderType = ticket === "stop" ? "STOP_LOSS" : side === "buy" ? "LIMIT_BUY" : "LIMIT_SELL";
  const simpleGoal = ticket === "stop" ? "stop-loss" : side === "buy" ? "buy-dip" : "take-profit";
  const quoteDecimals = limitOrders.config.quoteToken.decimals;
  const maxOrderUsd = orderMarketState ? Number(formatUnits(orderMarketState.maxQuoteIn, quoteDecimals)) : null;

  const oraclePx = orderMarketState?.currentPrice != null ? Number(orderMarketState.currentPrice) / 10 ** PRICE_DECIMALS : null;

  const orderLines = useMemo<PriceLine[]>(() => {
    if (!orderMarket) return [];
    const lines: PriceLine[] = [];
    const px = (v: bigint) => Number(v) / 10 ** PRICE_DECIMALS;
    const forMarket = (a: string) => a.toLowerCase() === orderMarket.stockToken.toLowerCase();
    // Orders fill against the Chainlink price, which can sit away from the DEX pool price the candles show.
    if (oraclePx != null) lines.push({ price: oraclePx, label: `Chainlink $${formatPrice(oraclePx)}`, tone: "info" });
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
  }, [limitOrders.openOrders, orderMarket, oraclePx]);

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

  // Chart and order-book prices are DEX prices; orders trigger on Chainlink. Convert so the field holds the order price.
  const pickPrice = (p: number) => {
    const c = chartToOrderPrice(p, oraclePx, price);
    const use = c ? c.price : p;
    nonce.current += 1;
    setPickedPrice({
      price: use.toFixed(use >= 1 ? 2 : 6),
      nonce: nonce.current,
      note: c ? { chartPrice: p, gapPct: c.gapPct, suspect: c.suspect } : undefined,
    });
  };

  const pickMarket = (m: TradeMarket) => {
    setMarket(m);
    setPickedPrice(null);
  };
  const openCount = limitOrders.openOrders.length;
  const sideBtn = "min-h-[40px] rounded-lg text-sm font-semibold";

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-3 px-1 pb-24 sm:px-2 lg:pb-4">
      {ordersEnabled && (
        <TradeTabs
          current={ticket === "recurring" ? "auto-invest" : ticket === "market" ? "chart" : "orders"}
          onSelect={(view) => {
            if (view === "orders") setTicket((t) => (t === "stop" ? "stop" : "limit"));
            if (view === "chart") setTicket("market");
          }}
        />
      )}

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
            <ChevronDown size={16} className="text-[var(--ink-muted)] 2xl:hidden" />
          </button>
          <div className="2xl:hidden">
            <MarketPicker open={pickerOpen} onClose={() => setPickerOpen(false)} selected={market?.address} onPick={pickMarket} />
          </div>
        </div>

        <div>
          <div className="text-xl font-extrabold tabular-nums text-[var(--ink)]">{price != null ? `$${formatPrice(price)}` : "—"}</div>
          <div className="text-xs"><ChangePill pct={change} /> <span className="text-[var(--ink-muted)]">24h</span></div>
        </div>
        {oraclePx != null && price != null && price > 0 && (
          <div
            className="text-[11px] leading-tight text-[var(--ink-muted)]"
            title="Chart candles come from DEX pools. Limit and stop orders fill against the on-chain Chainlink price."
          >
            <span className="block">Chainlink <b className="tabular-nums text-[var(--ink)]">${formatPrice(oraclePx)}</b></span>
            <span className={Math.abs(oraclePx / price - 1) > 0.01 ? "font-semibold text-amber-500" : ""}>
              {oraclePx >= price ? "+" : ""}{((oraclePx / price - 1) * 100).toFixed(2)}% vs DEX
            </span>
          </div>
        )}
        {orderMarketState && (
          <span
            title="Orders execute against the on-chain Chainlink price"
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold md:inline-flex ${
              feed?.state === "stale" ? "border-amber-500/30 text-amber-500" : "border-[var(--border-subtle)] text-[var(--ink-muted)]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${feed?.state === "fresh" ? "bg-emerald-500" : feed?.state === "stale" ? "bg-amber-500" : "bg-[var(--ink-dim)]"}`} />
            {feed?.label}
          </span>
        )}
        <dl className="flex gap-5 text-xs">
          <div><dt className="text-[var(--ink-muted)]">24h volume</dt><dd className="font-semibold tabular-nums text-[var(--ink)]">{compactUsd(summary?.volume24h ?? market?.volume24hUsd)}</dd></div>
          <div><dt className="text-[var(--ink-muted)]">Liquidity</dt><dd className="font-semibold tabular-nums text-[var(--ink)]">{compactUsd(summary?.liquidityUsd)}</dd></div>
          <div className="hidden sm:block"><dt className="text-[var(--ink-muted)]">Market cap</dt><dd className="font-semibold tabular-nums text-[var(--ink)]">{compactUsd(summary?.marketCap)}</dd></div>
        </dl>
        {market && (
          <div className="flex items-center gap-0.5 sm:ml-auto">
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
      </div>

      {watchlist.items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 2xl:hidden" aria-label="Watchlist">
          {watchlist.items.map((w) => (
            <button
              key={w.address}
              type="button"
              onClick={() => pickMarket({ ...w, priceUsd: null, change24h: null, volume24hUsd: null })}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${market?.address.toLowerCase() === w.address.toLowerCase() ? "border-[var(--brand-text)] bg-[var(--brand-soft)] text-[var(--ink)]" : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              <Star size={11} className="fill-amber-400 text-amber-400" />
              {w.symbol}
            </button>
          ))}
        </div>
      )}

      {orderMarketState && orderMarketState.pendingRiskEta > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
          <b>Heads up:</b> a change to how {orderMarketState.symbol} orders are priced or routed is queued and takes effect{" "}
          {new Date(orderMarketState.pendingRiskEta * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.
          If you are unsure, cancel your open {orderMarketState.symbol} orders before then. Cancelling always returns your deposit.
        </div>
      )}

      {/* Terminal: markets rail | chart + panels | ticket */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[250px_minmax(0,1fr)_390px]">
        <div className="hidden 2xl:col-start-1 2xl:row-span-2 2xl:row-start-1 2xl:block">
          <div className="2xl:sticky 2xl:top-3">
            <MarketRail selected={market?.address} onPick={pickMarket} watchlist={watchlist} />
          </div>
        </div>

        {/* Chart */}
        <section
          aria-label="Price chart"
          className={
            fullscreen
              ? "fixed inset-0 z-[60] overflow-y-auto bg-[var(--surface)] p-3"
              : "min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-card sm:p-3 lg:col-start-1 lg:row-start-1 2xl:col-start-2"
          }
        >
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
                <button key={k} type="button" aria-pressed={indicators[k]} onClick={() => setIndicators((v) => ({ ...v, [k]: !v[k] }))} className={`min-h-[28px] rounded-md px-2 text-[11px] font-semibold ${indicators[k] ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>{label}</button>
              ))}
              <button
                type="button"
                aria-label={fullscreen ? "Exit full screen" : "Full screen chart"}
                onClick={() => setFullscreen((v) => !v)}
                className="grid h-7 w-7 place-items-center rounded-md bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
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
              height={fullscreen ? 640 : narrow ? 340 : 460}
              onPickPrice={
                onOrderTab && canPlaceOrders && orderMode === "pro"
                  ? pickPrice
                  : undefined
              }
            />
          </div>
          {chartNote && <p className="px-2 pb-1 text-[11px] text-[var(--ink-muted)]">{chartNote}</p>}
          {onOrderTab && canPlaceOrders && orderMode === "pro" && <p className="px-2 pt-1 text-[11px] text-[var(--ink-muted)]">Click the chart to set your order price</p>}
        </section>

        {/* Order ticket: one box for market, limit, stop and recurring */}
        <aside
          ref={ticketRef}
          id="trade-ticket"
          aria-label="Order ticket"
          className="min-w-0 space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 2xl:col-start-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:self-start lg:overflow-y-auto"
        >
          {ticket !== "recurring" && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1" role="group" aria-label="Buy or sell">
              <button type="button" aria-pressed={side === "buy"} onClick={() => pickSide("buy")} className={`min-h-[42px] rounded-lg text-sm font-extrabold transition ${side === "buy" ? "bg-green-600 text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                Buy
              </button>
              <button type="button" aria-pressed={side === "sell"} onClick={() => pickSide("sell")} className={`min-h-[42px] rounded-lg text-sm font-extrabold transition ${side === "sell" ? "bg-red-600 text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                Sell
              </button>
            </div>
          )}
          <div className={`grid gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 ${!ordersEnabled ? "grid-cols-1" : side === "sell" || ticket === "recurring" ? "grid-cols-4" : "grid-cols-3"}`} role="tablist">
            {(
              [
                ["market", "Market"],
                ["limit", "Limit"],
                ["stop", "Stop"],
                ["recurring", "Recurring"],
              ] as const
            )
              .filter(([id]) => id === "market" || (ordersEnabled && (id !== "stop" || side === "sell" || ticket === "stop")))
              .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={ticket === id}
                  onClick={() => setTicket(id)}
                  className={`${sideBtn} ${ticket === id ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs" : "text-[var(--ink-muted)]"}`}
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
              key={`market-${side}-${market?.address ?? ""}`}
              prefillReceiveCounter={side === "buy" ? swapPick : null}
              prefillFromCounter={sellPrefill}
              currentBuyToken={side === "sell" ? USDC_COUNTER : undefined}
            />
          )}

          {onOrderTab && ordersEnabled && (
            <>
              {!canPlaceOrders && market && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--ink-muted)]">
                  Limit, stop-loss, trailing-stop and OCO orders run on the on-chain order book, which supports these markets on this network:
                  {" "}{limitOrders.config.markets.map((m) => m.symbol).join(", ") || "none"}. <b className="text-[var(--ink)]">{market.symbol}</b> can still be traded at market from the Market tab.
                </div>
              )}
              {canPlaceOrders && (
                <>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-2)] p-1" role="group" aria-label="Order mode">
                    {(["simple", "scale", "pro"] as const).map((m) => (
                      <button key={m} type="button" aria-pressed={orderMode === m} onClick={() => setOrderMode(m)} className={`min-h-[34px] rounded-lg text-xs font-bold capitalize ${orderMode === m ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs" : "text-[var(--ink-muted)]"}`}>
                        {m === "simple" ? "Simple" : m === "scale" ? "Scale" : "Pro"}
                      </button>
                    ))}
                  </div>
                  {maxOrderUsd != null && Number.isFinite(maxOrderUsd) && maxOrderUsd > 0 && (
                    <p className="px-1 text-[11px] text-[var(--ink-muted)]">
                      Beta limit on this market: up to <b className="tabular-nums text-[var(--ink)]">${maxOrderUsd.toLocaleString()}</b> per order. Limits are set on-chain and raised in steps as the order book proves itself.
                    </p>
                  )}
                </>
              )}
              {pickedPrice?.note && (
                <p
                  role="status"
                  className={`rounded-xl border px-3 py-2 text-[11px] leading-snug ${
                    pickedPrice.note.suspect ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)]"
                  }`}
                >
                  You picked <b className="tabular-nums text-[var(--ink)]">${formatPrice(pickedPrice.note.chartPrice)}</b> on the chart. Orders trigger on the Chainlink price, which is{" "}
                  <b>{pickedPrice.note.gapPct >= 0 ? "+" : ""}{pickedPrice.note.gapPct.toFixed(2)}%</b> from the chart right now, so the price field shows{" "}
                  <b className="tabular-nums text-[var(--ink)]">${pickedPrice.price}</b>.
                  {pickedPrice.note.suspect && " The two prices are far apart, so double-check before you confirm."}
                </p>
              )}
              <OrdersView
                key={`${ticket}-${side}-${market?.address ?? ""}`}
                hideSideSwitch
                initialOrderType={orderType}
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
                simple={orderMode === "simple" && canPlaceOrders}
                initialGoal={initialGoal && ticket !== "stop" && side === "buy" && initialGoal !== "stop-loss" && initialGoal !== "protect" ? initialGoal : simpleGoal}
                scale={orderMode === "scale" && canPlaceOrders}
                liquidityUsd={summary?.liquidityUsd ?? null}
                terminalPrice={price}
              />
            </>
          )}

          {ticket === "recurring" && ordersEnabled && (
            <Link href={AUTO_INVEST_HREF} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-3 py-2.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--brand)]">
              <span>Buying several stocks? Set up one basket plan</span>
              <span aria-hidden>→</span>
            </Link>
          )}

          {ticket === "recurring" && ordersEnabled && (
            limitOrders.chainId === 8453 && /^0x0{40}$/i.test(limitOrders.config.orderBook) ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-center shadow-card">
                <h3 className="text-base font-bold text-[var(--ink)]">Recurring plans aren&apos;t live on Base mainnet yet</h3>
                <p className="mx-auto max-w-sm text-xs text-[var(--ink-muted)]">You can try auto-buy and auto-sell with test tokens on Base Sepolia.</p>
                <button type="button" onClick={() => switchChain?.({ chainId: 84532 })} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--brand-hover)]">Switch to Base Sepolia</button>
              </div>
            ) : canPlaceOrders ? (
              <RecurringCard limitOrders={limitOrders} stockAddress={orderMarket?.stockToken} onConnectWallet={onRequestConnect} />
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--ink-muted)]">
                Recurring plans run on the on-chain order book. Supported markets here: {limitOrders.config.markets.map((m) => m.symbol).join(", ") || "none"}. Pick one from the market list to continue.
              </div>
            )
          )}
        </aside>

        {/* Under the chart: orders, trades, stats, balance */}
        {market && (
          <section aria-label="Market panels" className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-card lg:col-start-1 lg:row-start-2 2xl:col-start-2">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-2 pt-2">
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Market panels">
                {(
                  [
                    ["orders", ordersEnabled ? `Open orders${openCount ? ` (${openCount})` : ""}` : "Orders"],
                    ["book", "Order book"],
                    ["trades", "Recent trades"],
                    ["info", "Market info"],
                    ["balance", "Balance"],
                  ] as const
                )
                  .filter(([id]) => (id !== "orders" || ordersEnabled) && (id !== "book" || canPlaceOrders))
                  .map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={bottomTab === id}
                      onClick={() => setBottomTab(id)}
                      className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3 text-xs font-bold ${bottomTab === id ? "border-[var(--brand-text)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                    >
                      {label}
                    </button>
                  ))}
              </div>
              {ordersEnabled && openCount > 1 && bottomTab === "orders" && (
                <button
                  type="button"
                  disabled={limitOrders.txSubmitting}
                  onClick={() => {
                    if (window.confirm(`Cancel all ${openCount} open orders? Your deposits come back to your wallet.`)) {
                      void limitOrders.cancelOrdersBatch(limitOrders.openOrders.map((o) => o.id));
                    }
                  }}
                  className="mb-1 shrink-0 rounded-lg border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Cancel all
                </button>
              )}
            </div>
            <div className="p-2 sm:p-3">
              {bottomTab === "orders" && ordersEnabled && (
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
              )}
              {bottomTab === "book" && canPlaceOrders && orderMarket && (
                <OrderBookPanel
                  orderBook={limitOrders.config.orderBook as `0x${string}`}
                  chainId={limitOrders.chainId}
                  stockToken={orderMarket.stockToken}
                  stockDecimals={orderMarket.decimals}
                  quoteDecimals={quoteDecimals}
                  symbol={market.symbol}
                  wallet={app.wallet?.address}
                  poolPrice={price}
                  oraclePrice={oraclePx}
                  onPickPrice={(p) => {
                    // A click on a level fills the Pro limit form with that price
                    pickPrice(p);
                    setOrderMode("pro");
                    setTicket((t) => (t === "stop" ? "stop" : "limit"));
                  }}
                />
              )}
              {bottomTab === "trades" && <RecentTrades pool={pool} token={market.address} symbol={market.symbol} />}
              {bottomTab === "info" && <MarketInfo stats={stats} symbol={market.symbol} />}
              {bottomTab === "balance" && <Position holding={holding} price={price} symbol={market.symbol} />}
            </div>
          </section>
        )}
      </div>

      {/* Phone: jump to the ticket */}
      {market && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-40 lg:hidden">
          <button
            type="button"
            onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="h-12 w-full rounded-2xl bg-[var(--brand)] text-sm font-extrabold text-white shadow-lg"
          >
            Trade {market.symbol}
          </button>
        </div>
      )}
    </div>
  );
}
