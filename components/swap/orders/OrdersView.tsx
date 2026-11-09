"use client";

import { useState, useMemo, useEffect } from "react";
import { formatUnits, type Address } from "viem";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  ORDER_LABEL,
  PRICE_DECIMALS,
  parseDecimalInput,
  parseTriggerPrice,
  expectedAmountOut,
  minAmountOut,
  fillFloor,
  trailingStopPrice,
  validateOrder,
  validateTrailing,
  validateBracket,
  type OrderKind,
} from "@/src/lib/limitOrders/orderMath";
import type { useLimitOrders, MarketState } from "@/src/lib/limitOrders/useLimitOrders";
import MyOrdersPanel from "./MyOrdersPanel";

type OrderTypeTab = "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS" | "TRAILING_STOP" | "BRACKET";

const TYPE_EXPLANATIONS: Record<OrderTypeTab, string> = {
  LIMIT_BUY: "Buy when the price drops to or below your target.",
  LIMIT_SELL: "Sell to lock in gains when the price rises to or above your target.",
  STOP_LOSS: "Sell to cap losses when the price drops to or below your target.",
  TRAILING_STOP: "The stop rises with the highest price and never moves down. Needs the keeper running.",
  BRACKET: "When one fills, the other cancels automatically. One deposit.",
};

const SLIPPAGE_PRESETS = [0.5, 1.0, 2.0];
const TRAIL_PRESETS = [2, 5, 10];
const EXPIRY_PRESETS = [
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 86400 * 7 },
  { label: "30 days", seconds: 86400 * 30 },
];

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface OrdersViewProps {
  limitOrders: ReturnType<typeof useLimitOrders>;
  onConnectWallet?: () => void;
  onSwitchChain?: () => void;
  onSwitchSepolia?: () => void;
}

export default function OrdersView({
  limitOrders,
  onConnectWallet,
  onSwitchChain,
  onSwitchSepolia,
}: OrdersViewProps) {
  const {
    config,
    chainId,
    walletAddress,
    paused,
    keeperFeeBps,
    quoteBalance,
    quoteAllowance,
    marketStates,
    openOrders,
    historyOrders,
    regionRestricted,
    txSubmitting,
    txSuccessHash,
    approveToken,
    placeOrder,
    placeTrailingStop,
    placeBracket,
    updateOrder,
    cancelOrder,
    refundExpired,
  } = limitOrders;

  const [orderType, setOrderType] = useState<OrderTypeTab>("LIMIT_BUY");
  const [selectedStock, setSelectedStock] = useState<string>(
    config.markets[0]?.stockToken.toLowerCase() || ""
  );

  // Form inputs
  const [amountInput, setAmountInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [slInput, setSlInput] = useState("");
  const [trailPercent, setTrailPercent] = useState(5);
  const [customTrail, setCustomTrail] = useState("");
  const [slippagePercent, setSlippagePercent] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState("");
  const [expirySec, setExpirySec] = useState(86400 * 7); // 7 days

  // Auto-switch default slippage based on order type
  useEffect(() => {
    if (orderType === "LIMIT_BUY" || orderType === "LIMIT_SELL") {
      setSlippagePercent(1.0);
    } else {
      setSlippagePercent(2.0); // Stop-loss, trailing, bracket
    }
  }, [orderType]);

  // Keep selectedStock valid across chain switches (e.g. Sepolia vs Mainnet)
  useEffect(() => {
    const current = config.markets.find(
      (m) => m.stockToken.toLowerCase() === selectedStock.toLowerCase()
    );
    if (!current && config.markets.length > 0) {
      setSelectedStock(config.markets[0].stockToken.toLowerCase());
    }
  }, [config.markets, selectedStock]);

  const activeMarket: MarketState | undefined = marketStates[selectedStock];
  const stockSymbol = activeMarket?.symbol || "Stock";
  const stockDecimals = activeMarket?.decimals || 8;
  const quoteSymbol = config.quoteToken.symbol;
  const quoteDecimals = config.quoteToken.decimals;
  const currentPrice = activeMarket?.currentPrice || null;
  const isMarketStale = activeMarket?.isStale || false;

  const isBuy = orderType === "LIMIT_BUY";
  const inDecimals = isBuy ? quoteDecimals : stockDecimals;
  const inSymbol = isBuy ? quoteSymbol : stockSymbol;
  const outDecimals = isBuy ? stockDecimals : quoteDecimals;
  const outSymbol = isBuy ? stockSymbol : quoteSymbol;

  const userBalance = isBuy ? quoteBalance : activeMarket?.userBalance || 0n;
  const userAllowance = isBuy ? quoteAllowance : activeMarket?.userAllowance || 0n;
  const maxInCap = isBuy ? activeMarket?.maxQuoteIn || config.maxQuoteIn : activeMarket?.maxStockIn || config.maxStockIn;

  // Slippage in BPS
  const activeSlippageBps = useMemo(() => {
    if (customSlippage.trim() !== "") {
      const n = parseFloat(customSlippage);
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 100;
    }
    return Math.round(slippagePercent * 100);
  }, [customSlippage, slippagePercent]);

  // Trail in BPS
  const activeTrailBps = useMemo(() => {
    if (customTrail.trim() !== "") {
      const n = parseFloat(customTrail);
      return Number.isFinite(n) && n >= 0.5 && n <= 50 ? Math.round(n * 100) : 500;
    }
    return Math.round(trailPercent * 100);
  }, [customTrail, trailPercent]);

  // Amount parsing
  const parsedAmountIn = useMemo(
    () => parseDecimalInput(amountInput, inDecimals),
    [amountInput, inDecimals]
  );

  // Trigger price parsing
  const parsedTrigger = useMemo(
    () => parseTriggerPrice(triggerInput),
    [triggerInput]
  );

  const parsedTakeProfit = useMemo(() => parseTriggerPrice(tpInput), [tpInput]);
  const parsedStopLoss = useMemo(() => parseTriggerPrice(slInput), [slInput]);

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const targetExpiry = nowSec + expirySec;

  // Calculations for preview
  const singleKind: OrderKind =
    orderType === "LIMIT_BUY"
      ? "LIMIT_BUY"
      : orderType === "LIMIT_SELL"
        ? "LIMIT_SELL"
        : "STOP_LOSS";

  const expectedOut = useMemo(() => {
    if (!parsedAmountIn) return 0n;
    if (orderType === "TRAILING_STOP") {
      if (!currentPrice) return 0n;
      const initialStop = trailingStopPrice(currentPrice, activeTrailBps);
      return expectedAmountOut("STOP_LOSS", parsedAmountIn, initialStop, stockDecimals, quoteDecimals);
    }
    if (orderType === "BRACKET") {
      // preview uses take profit
      if (!parsedTakeProfit) return 0n;
      return expectedAmountOut("LIMIT_SELL", parsedAmountIn, parsedTakeProfit, stockDecimals, quoteDecimals);
    }
    if (!parsedTrigger) return 0n;
    return expectedAmountOut(singleKind, parsedAmountIn, parsedTrigger, stockDecimals, quoteDecimals);
  }, [parsedAmountIn, orderType, currentPrice, activeTrailBps, parsedTakeProfit, parsedTrigger, singleKind, stockDecimals, quoteDecimals]);

  const minOut = useMemo(() => {
    if (expectedOut <= 0n) return 0n;
    return minAmountOut(expectedOut, activeSlippageBps);
  }, [expectedOut, activeSlippageBps]);

  const floorProtection = useMemo(() => {
    if (!parsedAmountIn || !currentPrice) return 0n;
    const kindForFloor = orderType === "LIMIT_BUY" ? "LIMIT_BUY" : "LIMIT_SELL";
    const devBps = activeMarket?.maxDeviationBps || config.defaultMaxDeviationBps;
    return fillFloor(kindForFloor, parsedAmountIn, currentPrice, stockDecimals, quoteDecimals, devBps);
  }, [parsedAmountIn, currentPrice, orderType, activeMarket?.maxDeviationBps, config.defaultMaxDeviationBps, stockDecimals, quoteDecimals]);

  // Distance calculations
  const triggerDistance = useMemo(() => {
    if (!currentPrice || !parsedTrigger || currentPrice === 0n) return null;
    const diff = Number(parsedTrigger - currentPrice);
    const pct = (diff / Number(currentPrice)) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  }, [currentPrice, parsedTrigger]);

  const tpDistance = useMemo(() => {
    if (!currentPrice || !parsedTakeProfit || currentPrice === 0n) return null;
    const diff = Number(parsedTakeProfit - currentPrice);
    const pct = (diff / Number(currentPrice)) * 100;
    return `+${pct.toFixed(2)}%`;
  }, [currentPrice, parsedTakeProfit]);

  const slDistance = useMemo(() => {
    if (!currentPrice || !parsedStopLoss || currentPrice === 0n) return null;
    const diff = Number(parsedStopLoss - currentPrice);
    const pct = (diff / Number(currentPrice)) * 100;
    return `${pct.toFixed(2)}%`;
  }, [currentPrice, parsedStopLoss]);

  // Starting stop for trailing stop
  const initialTrailingStop = useMemo(() => {
    if (!currentPrice) return null;
    return trailingStopPrice(currentPrice, activeTrailBps);
  }, [currentPrice, activeTrailBps]);

  // Validation
  const validationMessage = useMemo(() => {
    if (orderType === "TRAILING_STOP") {
      return validateTrailing({
        amountIn: parsedAmountIn,
        trailBps: activeTrailBps,
        slippageBps: activeSlippageBps,
        keeperFeeBps,
        balance: userBalance,
        maxAmountIn: maxInCap,
        expiry: targetExpiry,
        nowSec,
      });
    }

    if (orderType === "BRACKET") {
      return validateBracket({
        amountIn: parsedAmountIn,
        takeProfit: parsedTakeProfit,
        stopLoss: parsedStopLoss,
        currentPrice,
        slippageBps: activeSlippageBps,
        keeperFeeBps,
        balance: userBalance,
        maxAmountIn: maxInCap,
        expiry: targetExpiry,
        nowSec,
      });
    }

    return validateOrder({
      kind: singleKind,
      amountIn: parsedAmountIn,
      trigger: parsedTrigger,
      currentPrice,
      slippageBps: activeSlippageBps,
      keeperFeeBps,
      balance: userBalance,
      maxAmountIn: maxInCap,
      expiry: targetExpiry,
      nowSec,
    });
  }, [
    orderType,
    parsedAmountIn,
    activeTrailBps,
    activeSlippageBps,
    keeperFeeBps,
    userBalance,
    maxInCap,
    targetExpiry,
    nowSec,
    parsedTakeProfit,
    parsedStopLoss,
    currentPrice,
    singleKind,
    parsedTrigger,
  ]);

  // Allowance check
  const needsApproval = useMemo(() => {
    if (!parsedAmountIn || parsedAmountIn <= 0n) return false;
    return userAllowance < parsedAmountIn;
  }, [parsedAmountIn, userAllowance]);

  const handleMaxAmount = () => {
    if (userBalance > 0n) {
      const capped = userBalance > maxInCap ? maxInCap : userBalance;
      setAmountInput(formatUnits(capped, inDecimals));
    }
  };

  const handleApprove = async () => {
    if (!parsedAmountIn) return;
    const tokenAddr = isBuy ? config.quoteToken.address : (selectedStock as Address);
    await approveToken(tokenAddr, parsedAmountIn, inSymbol);
  };

  const handleSubmitOrder = async () => {
    if (validationMessage || !parsedAmountIn || !activeMarket) return;

    if (orderType === "TRAILING_STOP") {
      const calculatedMinOut = minOut;
      const hash = await placeTrailingStop({
        stockToken: activeMarket.stockToken,
        amountIn: parsedAmountIn,
        trailBps: activeTrailBps,
        minAmountOut: calculatedMinOut,
        expiry: targetExpiry,
      });
      if (hash) {
        setAmountInput("");
      }
      return;
    }

    if (orderType === "BRACKET") {
      if (!parsedTakeProfit || !parsedStopLoss) return;
      const expectedTp = expectedAmountOut("LIMIT_SELL", parsedAmountIn, parsedTakeProfit, stockDecimals, quoteDecimals);
      const expectedSl = expectedAmountOut("STOP_LOSS", parsedAmountIn, parsedStopLoss, stockDecimals, quoteDecimals);
      const minOutTp = minAmountOut(expectedTp, activeSlippageBps);
      const minOutSl = minAmountOut(expectedSl, activeSlippageBps);

      const hash = await placeBracket({
        stockToken: activeMarket.stockToken,
        amountIn: parsedAmountIn,
        takeProfitPrice: parsedTakeProfit,
        stopLossPrice: parsedStopLoss,
        minOutTakeProfit: minOutTp,
        minOutStopLoss: minOutSl,
        expiry: targetExpiry,
      });
      if (hash) {
        setAmountInput("");
        setTpInput("");
        setSlInput("");
      }
      return;
    }

    if (!parsedTrigger) return;
    const orderTypeIdx = orderType === "LIMIT_BUY" ? 0 : orderType === "LIMIT_SELL" ? 1 : 2;
    const label = ORDER_LABEL[singleKind];
    const hash = await placeOrder({
      stockToken: activeMarket.stockToken,
      orderType: orderTypeIdx,
      amountIn: parsedAmountIn,
      triggerPrice: parsedTrigger,
      minAmountOut: minOut,
      expiry: targetExpiry,
      label: `Place ${label}`,
    });
    if (hash) {
      setAmountInput("");
      setTriggerInput("");
    }
  };

  const isWrongChain = chainId !== 8453 && chainId !== 84532;
  const isMainnetWithoutOrderBook =
    chainId === 8453 &&
    (!config.orderBook || config.orderBook === "0x0000000000000000000000000000000000000000");

  return (
    <div className="space-y-4">
      {/* Beta badge & Paused / Region alert banners */}
      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-500 text-white uppercase tracking-wider">
            Beta
          </span>
          <span className="text-[var(--ink-muted)]">
            Oracle-bounded execution &middot; Small beta limits
          </span>
        </div>
        <span className="text-[11px] text-[var(--ink-muted)]">
          Fee: {(keeperFeeBps / 100).toFixed(2)}%
        </span>
      </div>

      {paused && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
          <Lock size={15} className="shrink-0" />
          <span>
            Orders are paused right now. Creating orders is disabled, but you can still cancel and withdraw.
          </span>
        </div>
      )}

      {regionRestricted && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            {"These orders aren't available in your region. You can still cancel and withdraw existing orders."}
          </span>
        </div>
      )}

      {/* Mainnet Placeholder when Order Book not deployed on Base Mainnet */}
      {isMainnetWithoutOrderBook ? (
        <div
          data-testid="mainnet-orders-placeholder"
          className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-4 shadow-card"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Layers size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Orders aren&apos;t live on Base mainnet yet. Switch to Base Sepolia to test.
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-1.5 max-w-sm mx-auto">
              Testnet contracts are deployed on Base Sepolia. You can test limit buy, take-profit, stop-loss, trailing stop, and bracket orders.
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchSepolia}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0052FF] text-white text-xs font-bold hover:bg-[#0045D8] transition cursor-pointer shadow-xs"
          >
            <span>Switch to Base Sepolia</span>
          </button>
        </div>
      ) : (
        <>
          {isMarketStale && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
              <Info size={15} className="shrink-0" />
              <span>
                {`Price last updated ${activeMarket?.updatedAt ? formatTimeAgo(nowSec - activeMarket.updatedAt) : "some time"} ago. Markets may be closed; orders execute at the last known price within the protection bound.`}
              </span>
            </div>
          )}

      {/* Main Order Form Card */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-card space-y-4">
        {/* Type selector */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Order Type
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            {(
              [
                ["LIMIT_BUY", "Limit buy"],
                ["LIMIT_SELL", "Take-profit"],
                ["STOP_LOSS", "Stop-loss"],
                ["TRAILING_STOP", "Trailing stop"],
                ["BRACKET", "Bracket"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={`text-[11px] font-semibold py-2 px-2 min-h-[44px] flex items-center justify-center rounded-lg transition text-center truncate ${
                  orderType === t
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--ink-muted)] min-h-[18px]">
            {TYPE_EXPLANATIONS[orderType]}
          </p>
        </div>

        {/* Stock Selector & Live Price */}
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="stock-select"
              className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider mb-0.5"
            >
              Stock Asset
            </label>
            <div className="relative">
              <select
                id="stock-select"
                aria-label="Stock Asset"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-[var(--ink)] focus:outline-hidden cursor-pointer appearance-none pr-6"
              >
                {config.markets.map((m) => (
                  <option
                    key={m.stockToken}
                    value={m.stockToken.toLowerCase()}
                    className="bg-[var(--surface)] text-[var(--ink)]"
                  >
                    {m.symbol} &middot; {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none"
              />
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              Market Price
            </span>
            <span className="text-sm font-mono font-bold text-[var(--ink)] tabular-nums">
              {currentPrice !== null ? `$${formatUnits(currentPrice, PRICE_DECIMALS)}` : "—"}
            </span>
          </div>
        </div>

        {/* Deposit / Budget Amount */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="order-amount-input"
              className="text-xs font-semibold text-[var(--ink)]"
            >
              {isBuy ? "You Spend (USDC)" : `You Escrow (${stockSymbol})`}
            </label>
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <span>
                Balance: {formatUnits(userBalance, inDecimals)} {inSymbol}
              </span>
              <button
                type="button"
                onClick={handleMaxAmount}
                className="text-[10px] font-bold text-[var(--brand-text)] hover:underline px-1 py-0.5 rounded-sm bg-[var(--surface-2)]"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              id="order-amount-input"
              type="text"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono text-base focus:outline-hidden focus:ring-2 focus:ring-[var(--brand)]"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ink-muted)] pointer-events-none">
              {inSymbol}
            </span>
          </div>
          <p className="text-[11px] text-[var(--ink-muted)]">
            Per-order beta cap: {formatUnits(maxInCap, inDecimals)} {inSymbol}
          </p>
        </div>

        {/* Dynamic Inputs by Type */}
        {orderType === "TRAILING_STOP" ? (
          <div className="space-y-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
            <div className="flex items-center justify-between">
              <label
                htmlFor="custom-trail-distance"
                className="text-xs font-semibold text-[var(--ink)]"
              >
                Trail Distance (%)
              </label>
              <div className="flex items-center gap-1">
                {TRAIL_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setTrailPercent(p);
                      setCustomTrail("");
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      trailPercent === p && customTrail === ""
                        ? "bg-purple-600 text-white border-purple-600"
                        : "border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <input
              id="custom-trail-distance"
              type="number"
              step="0.1"
              min="0.5"
              max="50"
              value={customTrail || trailPercent}
              onChange={(e) => setCustomTrail(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-mono text-sm"
            />
            {initialTrailingStop && (
              <div className="text-[11px] text-[var(--ink-muted)] flex items-center justify-between">
                <span>Initial Stop Price:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  ${formatUnits(initialTrailingStop, PRICE_DECIMALS)}
                </span>
              </div>
            )}
          </div>
        ) : orderType === "BRACKET" ? (
          <div className="space-y-3 p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Layers size={14} /> Bracket Settings (One Deposit)
            </div>
            {/* Take-profit leg input */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label
                  htmlFor="bracket-tp-price"
                  className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                >
                  <TrendingUp size={12} /> Take-Profit Price (USD)
                </label>
                {tpDistance && (
                  <span className="text-[10px] font-bold text-emerald-500">{tpDistance}</span>
                )}
              </div>
              <input
                id="bracket-tp-price"
                type="text"
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                placeholder="Target above current price"
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-mono text-sm"
              />
            </div>
            {/* Stop-loss leg input */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label
                  htmlFor="bracket-sl-price"
                  className="font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1"
                >
                  <TrendingDown size={12} /> Stop-Loss Price (USD)
                </label>
                {slDistance && (
                  <span className="text-[10px] font-bold text-rose-500">{slDistance}</span>
                )}
              </div>
              <input
                id="bracket-sl-price"
                type="text"
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                placeholder="Target below current price"
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-mono text-sm"
              />
            </div>
          </div>
        ) : (
          /* Standard Trigger Price */
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="order-trigger-price"
                className="text-xs font-semibold text-[var(--ink)]"
              >
                Trigger Price (USD)
              </label>
              {triggerDistance && (
                <span
                  className={`text-xs font-bold ${
                    triggerDistance.startsWith("+") ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {triggerDistance} vs market
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="order-trigger-price"
                type="text"
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono text-base focus:outline-hidden focus:ring-2 focus:ring-[var(--brand)]"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ink-muted)] pointer-events-none">
                USD
              </span>
            </div>
          </div>
        )}

        {/* Slippage & Expiry Controls */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Slippage */}
          <div className="space-y-1">
            <label className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              Max Slippage
            </label>
            <div className="flex items-center gap-1">
              {SLIPPAGE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSlippagePercent(p);
                    setCustomSlippage("");
                  }}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-md border ${
                    slippagePercent === p && customSlippage === ""
                      ? "bg-[#0052FF] text-white border-[#0052FF]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-1">
            <label className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              Expiry
            </label>
            <div className="flex items-center gap-1">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => setExpirySec(p.seconds)}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-md border ${
                    expirySec === p.seconds
                      ? "bg-[#0052FF] text-white border-[#0052FF]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-xs">
          <div className="flex items-center justify-between text-[var(--ink-muted)]">
            <span>Estimated Receive</span>
            <span className="font-semibold text-[var(--ink)] tabular-nums">
              {expectedOut > 0n ? `${formatUnits(expectedOut, outDecimals)} ${outSymbol}` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[var(--ink-muted)]">
            <span>Minimum Receive (Post-Fee)</span>
            <span className="font-semibold text-[var(--ink)] tabular-nums">
              {minOut > 0n ? `${formatUnits(minOut, outDecimals)} ${outSymbol}` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)] pt-1 border-t border-[var(--border-subtle)]">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck size={13} /> Protected fill floor:
            </span>
            <span className="font-semibold tabular-nums">
              {floorProtection > 0n ? `${formatUnits(floorProtection, outDecimals)} ${outSymbol}` : "—"}
            </span>
          </div>
          <p className="text-[10px] text-[var(--ink-muted)] leading-tight">
            Protected: a fill must be within {(activeMarket?.maxDeviationBps || 300) / 100}% of the Chainlink market price.
          </p>
        </div>

        {/* Risk Disclaimer */}
        {(orderType === "STOP_LOSS" || orderType === "TRAILING_STOP" || orderType === "BRACKET") && (
          <p className="text-[11px] text-[var(--ink-muted)] italic leading-tight px-1">
            * Not guaranteed. If the market gaps or liquidity is thin, it may not fill at your price, and it will not fill below your minimum.
          </p>
        )}

        {/* Validation Error Feedback */}
        {validationMessage && amountInput.trim() !== "" && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{validationMessage}</span>
          </div>
        )}

        {/* Pre-Flight Plain-Language Summary Box */}
        {amountInput.trim() !== "" && parsedAmountIn !== null && parsedAmountIn > 0n && !validationMessage && (
          <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-2 text-xs">
            <div className="font-bold text-[var(--ink)] flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <CheckCircle2 size={13} />
              <span>Order Pre-Flight Summary</span>
            </div>
            <div className="space-y-1 text-[11px] text-[var(--ink-muted)]">
              <div className="flex justify-between">
                <span>You deposit:</span>
                <span className="font-semibold text-[var(--ink)] tabular-nums">
                  {formatUnits(parsedAmountIn, inDecimals)} {inSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Target trigger:</span>
                <span className="font-semibold text-[var(--ink)] tabular-nums">
                  {orderType === "TRAILING_STOP"
                    ? `${trailPercent}% trail`
                    : orderType === "BRACKET"
                    ? `TP: $${triggerInput} · SL: $${slInput}`
                    : `$${triggerInput}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Min receive floor:</span>
                <span className="font-semibold text-[var(--ink)] tabular-nums">
                  {minOut > 0n ? `${formatUnits(minOut, outDecimals)} ${outSymbol}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Target contract:</span>
                <span className="font-mono text-[var(--ink)]">
                  OrderBook ({config.orderBook.slice(0, 6)}…{config.orderBook.slice(-4)})
                </span>
              </div>
            </div>
            <p className="text-[10px] text-[var(--ink-muted)] pt-1 border-t border-blue-500/10">
              Exact token approval only &middot; No unlimited allowance &middot; Funds remain yours until filled
            </p>
          </div>
        )}

        {/* Action Button Flow */}
        <div>
          {!walletAddress ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0045D8] transition shadow-xs flex items-center justify-center cursor-pointer"
            >
              Connect Wallet
            </button>
          ) : isWrongChain ? (
            <button
              type="button"
              onClick={onSwitchChain}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition flex items-center justify-center cursor-pointer"
            >
              Switch to Base
            </button>
          ) : regionRestricted ? (
            <button
              type="button"
              disabled
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)] font-bold text-sm cursor-not-allowed border border-[var(--border-subtle)] flex items-center justify-center"
            >
              {"These orders aren't available in your region"}
            </button>
          ) : paused ? (
            <button
              type="button"
              disabled
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)] font-bold text-sm cursor-not-allowed border border-[var(--border-subtle)] flex items-center justify-center"
            >
              Orders Paused
            </button>
          ) : needsApproval ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={txSubmitting}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0045D8] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {txSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Approving {inSymbol}…</span>
                </>
              ) : (
                `Approve ${inSymbol}`
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={Boolean(validationMessage) || txSubmitting}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0045D8] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none shadow-xs cursor-pointer"
            >
              {txSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting Order…</span>
                </>
              ) : orderType === "LIMIT_BUY" ? (
                "Place Limit Buy"
              ) : orderType === "LIMIT_SELL" ? (
                "Place Take-profit"
              ) : orderType === "STOP_LOSS" ? (
                "Place Stop-loss"
              ) : orderType === "TRAILING_STOP" ? (
                "Place Trailing Stop"
              ) : (
                "Place Bracket Order"
              )}
            </button>
          )}
        </div>

        {/* Transaction Success Alert */}
        {txSuccessHash && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} /> Transaction broadcast successfully!
            </span>
            <a
              href={`https://${chainId === 84532 ? "sepolia." : ""}basescan.org/tx/${txSuccessHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-bold underline hover:opacity-80"
            >
              Basescan <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
        </>
      )}

      {/* "My orders" Panel */}
      <MyOrdersPanel
        openOrders={openOrders}
        historyOrders={historyOrders}
        markets={marketStates}
        quoteSymbol={quoteSymbol}
        quoteDecimals={quoteDecimals}
        onCancelOrder={cancelOrder}
        onRefundExpired={refundExpired}
        onUpdateOrder={updateOrder}
        isSubmitting={txSubmitting}
      />
    </div>
  );
}
