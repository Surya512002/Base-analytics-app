"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Settings2,
  ArrowDownUp,
} from "lucide-react";
import { formatUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { fetchSwapQuote, type LaunchDex } from "@/lib/api/launchpad-client";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { captureTokenReferrerFromUrl, readTokenReferrer } from "@/lib/utils/referral";
import { dexLabel, type SwapVenue } from "@/lib/launchpad/dex";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatUsd } from "@/lib/launchpad/format";
import { computeSwapUsd } from "@/lib/launchpad/swap-display";
import { fetchTokenPairs } from "@/lib/api/launchpad-token-client";
import TokenPickerDialog, {
  CounterAvatar,
  ETH_COUNTER,
  counterDecimalsOf,
  counterSymbol,
  sameCounter,
  type SwapCounter,
} from "@/components/launchpad/TokenPickerDialog";
import {
  amountFromBalanceFraction,
  amountFromRawBalanceFraction,
  formatTokenBalanceDisplay,
  formatTokenInputAmount,
  sanitizeTokenAmountInput,
} from "@/lib/launchpad/token-amount";
import {
  launchedToCounter,
  normalizeEthWeth,
  resolveDexSwapRoute,
} from "@/lib/launchpad/dex-swap-params";
import { enrichSwapCounter } from "@/lib/launchpad/token-logo";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";

const ROUTE_OPTIONS: { id: LaunchDex; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "aerodrome", label: "Aerodrome" },
  { id: "uniswap", label: "Uniswap" },
  { id: "slipstream", label: "Slipstream" },
];

const SLIPPAGE_PRESETS = ["0.5", "1", "3", "5"];
const MAX_ETH_FRACTION = 0.97;
const MAX_TOKEN_FRACTION = 0.995;
const HIGH_IMPACT_PCT = 5;
const DOLLAR_PEGGED = new Set(["USDC", "USDT", "DAI", "USDBC", "USDS", "USDE"]);

function defaultFromAmount(counter: SwapCounter): string {
  if (counter.kind === "eth") return "0.01";
  const sym = counter.symbol.toUpperCase();
  return DOLLAR_PEGGED.has(sym) ? "10" : "1";
}

function formatQuoteOut(amountOut: string, decimals: number): string {
  const n = Number(amountOut) / 10 ** decimals;
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

function isPresetSlippage(value: string): boolean {
  return SLIPPAGE_PRESETS.includes(value);
}

function sanitizeCustomSlippage(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function parseSlippageBps(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.round(Math.min(50, Math.max(0.1, n)) * 100);
}

function formatUsdSide(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return formatUsd(value);
}

function TokenSelect({
  counter,
  placeholder,
  onOpen,
}: {
  counter: SwapCounter | null;
  placeholder?: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="dex-swap-token-btn">
      {counter ? (
        <>
          <CounterAvatar counter={counter} size={22} />
          <span className="dex-swap-token-symbol">{counterSymbol(counter)}</span>
        </>
      ) : (
        <span className="dex-swap-token-placeholder">{placeholder ?? "Select"}</span>
      )}
      <ChevronDown size={14} className="opacity-50 shrink-0" />
    </button>
  );
}

export default function DexSwapPanel({
  app,
  guestMode,
  onRequestConnect,
  prefillToken,
  prefillReceiveCounter,
  onPrefillReceiveApplied,
  onReceiveTokenChange,
  prefillFromCounter,
  onPrefillFromApplied,
}: {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  /** Pre-select the receive token (e.g. from Explore Trade). */
  prefillToken?: LaunchedToken | null;
  /** Quick-pick receive token from sidebar chips. */
  prefillReceiveCounter?: SwapCounter | null;
  onPrefillReceiveApplied?: () => void;
  onReceiveTokenChange?: (token: {
    address: string;
    symbol: string;
    decimals: number;
    imageUrl?: string;
  } | null) => void;
  /** Pre-select the "from" (sell) token via wallet holdings. */
  prefillFromCounter?: SwapCounter | null;
  onPrefillFromApplied?: () => void;
}) {
  const { wallet, walletCore, swapLoading, handleTokenSwap, showToast } = app;

  const [from, setFrom] = useState<SwapCounter>(ETH_COUNTER);
  const [to, setTo] = useState<SwapCounter | null>(null);
  const [pickerSide, setPickerSide] = useState<"from" | "to" | null>(null);
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("1");
  const [dex, setDex] = useState<LaunchDex>("auto");
  const [showSettings, setShowSettings] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [minReceive, setMinReceive] = useState<string | null>(null);
  const [hasLiquidity, setHasLiquidity] = useState<boolean | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [activeDex, setActiveDex] = useState<SwapVenue | null>(null);
  const [quoteImpactBps, setQuoteImpactBps] = useState<number | null>(null);
  const [aggregatorReady, setAggregatorReady] = useState(true);
  const [ethUsd, setEthUsd] = useState(2500);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [highImpactAck, setHighImpactAck] = useState(false);
  const [activePct, setActivePct] = useState<string | null>(null);
  const [balanceTick, setBalanceTick] = useState(0);
  const [fromBalance, setFromBalance] = useState(0);
  const [fromBalanceRaw, setFromBalanceRaw] = useState<bigint>(BigInt(0));
  const [fromTokenUsd, setFromTokenUsd] = useState<number | null>(null);
  const [pageTokenUsd, setPageTokenUsd] = useState<number | null>(null);
  const [pageDecimals, setPageDecimals] = useState(18);

  const route = useMemo(() => {
    if (!to) return null;
    return resolveDexSwapRoute(from, to);
  }, [from, to]);

  const fromDecimals = counterDecimalsOf(from);

  useEffect(() => {
    if (!prefillFromCounter) return;
    setFrom(prefillFromCounter);
    onPrefillFromApplied?.();
  }, [prefillFromCounter, onPrefillFromApplied]);

  useEffect(() => {
    if (!onReceiveTokenChange) return;
    if (!to || to.kind === "eth") {
      onReceiveTokenChange(null);
      return;
    }
    onReceiveTokenChange({
      address: to.address,
      symbol: to.symbol,
      decimals: to.decimals,
      imageUrl: to.imageUrl,
    });
  }, [to, onReceiveTokenChange]);

  useEffect(() => {
    if (!prefillToken) return;
    const nextTo = launchedToCounter(prefillToken);
    if (sameCounter(normalizeEthWeth(nextTo), normalizeEthWeth(from))) {
      setFrom(ETH_COUNTER);
    }
    setTo(nextTo);
    setAmount(defaultFromAmount(from));
    captureTokenReferrerFromUrl(prefillToken.address);
    setReferrer(readTokenReferrer(prefillToken.address));
  }, [prefillToken?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep referral attached when user picks any page token (not only prefill).
  useEffect(() => {
    if (!route?.pageToken.address) return;
    captureTokenReferrerFromUrl(route.pageToken.address);
    setReferrer(readTokenReferrer(route.pageToken.address));
  }, [route?.pageToken.address]);

  useEffect(() => {
    if (!route) return;
    let alive = true;
    void (async () => {
      try {
        const n = await fetchErc20Decimals(
          route.pageToken.address as `0x${string}`,
          route.pageToken.decimals
        );
        if (alive) setPageDecimals(n);
      } catch {
        if (alive) setPageDecimals(route.pageToken.decimals);
      }
    })();
    return () => {
      alive = false;
    };
  }, [route]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/launchpad/eth-price", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ethUsd?: number }) => {
        if (!alive) return;
        if (d.ethUsd && d.ethUsd > 0) setEthUsd(d.ethUsd);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const fromUsd = useMemo(() => {
    if (from.kind === "eth") return ethUsd;
    const sym = from.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(sym)) return 1;
    if (sym === "WETH") return ethUsd;
    return fromTokenUsd;
  }, [from, ethUsd, fromTokenUsd]);

  const toUsd = useMemo(() => {
    if (!to) return null;
    if (to.kind === "eth") return ethUsd;
    const sym = to.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(sym)) return 1;
    if (sym === "WETH") return ethUsd;
    return pageTokenUsd;
  }, [to, ethUsd, pageTokenUsd]);

  const counterUsd = useMemo(() => {
    if (!route) return 0;
    // Buy: pay with `from` (counter). Sell: receive `to` (counter).
    return (route.direction === "buy" ? fromUsd : toUsd) ?? 0;
  }, [route?.direction, fromUsd, toUsd]);

  useEffect(() => {
    if (from.kind !== "token") {
      setFromTokenUsd(null);
      return;
    }
    const sym = from.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(sym) || sym === "WETH") {
      setFromTokenUsd(null);
      return;
    }
    let alive = true;
    void fetchTokenPairs(from.address)
      .then((d) => {
        if (!alive) return;
        const best = [...(d.pairs ?? [])].sort(
          (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
        )[0];
        const price = best?.priceUsd ? parseFloat(best.priceUsd) : NaN;
        setFromTokenUsd(Number.isFinite(price) && price > 0 ? price : null);
      })
      .catch(() => {
        if (alive) setFromTokenUsd(null);
      });
    return () => {
      alive = false;
    };
  }, [from]);

  useEffect(() => {
    if (!route) {
      setPageTokenUsd(null);
      return;
    }
    let alive = true;
    void fetchTokenPairs(route.pageToken.address)
      .then((d) => {
        if (!alive) return;
        const best = [...(d.pairs ?? [])].sort(
          (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
        )[0];
        const price = best?.priceUsd ? parseFloat(best.priceUsd) : NaN;
        setPageTokenUsd(Number.isFinite(price) && price > 0 ? price : null);
      })
      .catch(() => {
        if (alive) setPageTokenUsd(null);
      });
    return () => {
      alive = false;
    };
  }, [route]);

  const ethBalance = useMemo(() => {
    const bal = walletCore?.balance ?? wallet?.balance;
    if (!bal) return 0;
    const n = parseFloat(bal);
    return Number.isFinite(n) ? n : 0;
  }, [walletCore?.balance, wallet?.balance]);

  const refreshBalances = useCallback(() => {
    setBalanceTick((n) => n + 1);
  }, []);

  const readErc20Balance = useCallback(
    async (
      tokenAddr: `0x${string}`,
      decimals: number
    ): Promise<{ human: number; raw: bigint }> => {
      if (!wallet) return { human: 0, raw: BigInt(0) };
      try {
        const pub = createBasePublicClient();
        const raw = await pub.readContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [wallet.address as `0x${string}`],
        });
        const human = parseFloat(formatUnits(raw, decimals));
        return { human: Number.isFinite(human) ? human : 0, raw };
      } catch {
        return { human: 0, raw: BigInt(0) };
      }
    },
    [wallet]
  );

  useEffect(() => {
    if (!wallet) {
      setFromBalance(0);
      setFromBalanceRaw(BigInt(0));
      return;
    }
    let alive = true;
    void (async () => {
      if (from.kind === "eth") {
        if (!alive) return;
        setFromBalance(ethBalance);
        setFromBalanceRaw(BigInt(0));
        return;
      }
      const bal = await readErc20Balance(from.address as `0x${string}`, fromDecimals);
      if (!alive) return;
      setFromBalance(bal.human);
      setFromBalanceRaw(bal.raw);
    })();
    return () => {
      alive = false;
    };
  }, [wallet, from, fromDecimals, ethBalance, balanceTick, readErc20Balance]);

  const quoteAmountDecimals =
    route?.direction === "sell" ? pageDecimals : route?.counterDecimals ?? fromDecimals;
  const quoteAmount = useMemo(
    () => sanitizeTokenAmountInput(amount, quoteAmountDecimals),
    [amount, quoteAmountDecimals]
  );

  useEffect(() => {
    if (!route || !quoteAmount || parseFloat(quoteAmount) <= 0) {
      setQuoteOut(null);
      setMinReceive(null);
      setHasLiquidity(null);
      setQuoteError(null);
      setActiveDex(null);
      setQuoteImpactBps(null);
      setQuoteLoading(false);
      return;
    }
    let alive = true;
    setQuoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await fetchSwapQuote({
          token: route.pageToken.address,
          direction: route.direction,
          amount: quoteAmount,
          decimals: pageDecimals,
          slippageBps: parseSlippageBps(slippage),
          dex,
          referrer,
          taker: wallet?.address,
          counterDecimals: route.counterDecimals,
          payAsset: route.payAsset,
          receiveAsset: route.receiveAsset,
          payToken: route.payToken,
          receiveToken: route.receiveToken,
        });
        if (!alive) return;
        setQuoteLoading(false);
        setHasLiquidity(q.hasLiquidity);
        setQuoteError(q.hasLiquidity ? null : (q.error ?? null));
        setActiveDex(q.dex ?? null);
        setQuoteImpactBps(q.priceImpactBps ?? null);
        setAggregatorReady(q.aggregatorConfigured !== false);
        const outDec =
          q.outDecimals ??
          (route.direction === "buy" ? pageDecimals : route.counterDecimals);
        if (q.hasLiquidity && q.amountOut) {
          setQuoteOut(formatQuoteOut(q.amountOut, outDec));
          setMinReceive(
            q.amountOutMinimum ? formatQuoteOut(q.amountOutMinimum, outDec) : null
          );
        } else {
          setQuoteOut(null);
          setMinReceive(null);
        }
      } catch {
        if (!alive) return;
        setQuoteLoading(false);
        setHasLiquidity(false);
        setQuoteError("Network error — retry in a moment");
        setQuoteOut(null);
        setMinReceive(null);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [
    route,
    quoteAmount,
    slippage,
    dex,
    referrer,
    wallet?.address,
    pageDecimals,
    amount,
  ]);

  const payAmountNum = parseFloat(amount);
  const quoteOutNum = quoteOut != null ? parseFloat(quoteOut) : null;

  const { payUsd, receiveUsd } = useMemo(
    () =>
      computeSwapUsd({
        direction: route?.direction ?? "buy",
        payAmount: payAmountNum,
        quoteOut: quoteOutNum,
        counterUsd,
      }),
    [route?.direction, payAmountNum, quoteOutNum, counterUsd]
  );

  const priceImpactPct = useMemo(
    () => (quoteImpactBps == null ? null : quoteImpactBps / 100),
    [quoteImpactBps]
  );

  const needsImpactAck =
    hasLiquidity === true &&
    payAmountNum > 0 &&
    priceImpactPct != null &&
    priceImpactPct >= HIGH_IMPACT_PCT;

  useEffect(() => {
    setHighImpactAck(false);
  }, [from, to, amount, dex]);

  const flipPair = () => {
    if (!to) return;
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
    setAmount(defaultFromAmount(nextFrom));
    setQuoteOut(null);
    setMinReceive(null);
    setActivePct(null);
  };

  const pickToken = (side: "from" | "to", next: SwapCounter) => {
    const enriched = enrichSwapCounter(next);
    if (side === "from") {
      if (to && sameCounter(normalizeEthWeth(enriched), normalizeEthWeth(to))) {
        setTo(from);
      }
      setFrom(enriched);
      setAmount(defaultFromAmount(enriched));
    } else {
      if (sameCounter(normalizeEthWeth(enriched), normalizeEthWeth(from))) {
        showToast("Pick a different token than the pay side", "");
        return;
      }
      setTo(enriched);
    }
    setQuoteOut(null);
    setMinReceive(null);
    setActivePct(null);
    setPickerSide(null);
  };

  useEffect(() => {
    if (!prefillReceiveCounter) return;
    pickToken("to", prefillReceiveCounter);
    onPrefillReceiveApplied?.();
  }, [prefillReceiveCounter]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPct = (pct: number, label: string) => {
    setActivePct(label);
    const fraction =
      pct < 0
        ? from.kind === "eth"
          ? MAX_ETH_FRACTION
          : fromBalanceRaw > BigInt(0)
            ? MAX_TOKEN_FRACTION
            : 1
        : pct;
    const nextAmount =
      from.kind !== "eth" && fromBalanceRaw > BigInt(0)
        ? amountFromRawBalanceFraction(fromBalanceRaw, fromDecimals, fraction)
        : amountFromBalanceFraction(fromBalance, fromDecimals, fraction);
    setAmount(nextAmount);
  };

  const onAmountChange = (raw: string) => {
    setAmount(raw);
    setActivePct(null);
    if (!raw.trim() || parseFloat(raw) <= 0) {
      setQuoteOut(null);
      setMinReceive(null);
      setHasLiquidity(null);
      setQuoteError(null);
    }
  };

  const onSwap = async () => {
    if (!route || !to) return;
    if (needsImpactAck && !highImpactAck) {
      showToast("Check the box to confirm high price impact", "");
      return;
    }
    if (guestMode || !wallet) {
      onRequestConnect?.();
      return;
    }
    if (!hasLiquidity) {
      showToast(quoteError || "No swap route found", "");
      return;
    }
    const ok = await handleTokenSwap({
      token: route.pageToken.address,
      symbol: route.pageToken.symbol,
      decimals: pageDecimals,
      direction: route.direction,
      amount: sanitizeTokenAmountInput(amount, quoteAmountDecimals) || amount,
      slippageBps: parseSlippageBps(slippage),
      dex,
      referrer,
      counterDecimals: route.counterDecimals,
      payAsset: route.payAsset,
      receiveAsset: route.receiveAsset,
      payToken: route.payToken,
      receiveToken: route.receiveToken,
    });
    if (ok) {
      setAmount(defaultFromAmount(from));
      setQuoteOut(null);
      setActivePct(null);
      refreshBalances();
      window.setTimeout(refreshBalances, 2500);
      window.setTimeout(refreshBalances, 8000);
    }
  };

  const needsAggregator = route?.needsAggregator ?? false;
  const aggregatorMissing = needsAggregator && !aggregatorReady;
  const routeSelectable = !needsAggregator;
  const insufficientBalance =
    Boolean(wallet) &&
    !guestMode &&
    Number.isFinite(payAmountNum) &&
    payAmountNum > 0 &&
    payAmountNum > fromBalance;

  const canSwap =
    Boolean(to) &&
    Boolean(amount) &&
    payAmountNum > 0 &&
    parseSlippageBps(slippage) > 0 &&
    hasLiquidity &&
    !insufficientBalance &&
    !aggregatorMissing &&
    !(needsImpactAck && !highImpactAck);

  const fromLabel = counterSymbol(from);
  const toLabel = to ? counterSymbol(to) : "token";

  const ctaLabel = (() => {
    if (guestMode || !wallet) return "Connect wallet";
    if (!to) return "Select token";
    if (swapLoading) return "Confirm in wallet…";
    if (!amount || payAmountNum <= 0) return "Enter amount";
    if (insufficientBalance) return `Insufficient ${fromLabel}`;
    if (aggregatorMissing) return "Route unavailable";
    if (!hasLiquidity) return "No route";
    if (needsImpactAck && !highImpactAck) return "Confirm impact";
    return "Swap";
  })();

  const exchangeRate = useMemo(() => {
    if (
      !to ||
      !Number.isFinite(payAmountNum) ||
      payAmountNum <= 0 ||
      quoteOutNum == null ||
      quoteOutNum <= 0
    ) {
      return null;
    }
    const rate = quoteOutNum / payAmountNum;
    return `1 ${fromLabel} ≈ ${rate.toLocaleString(undefined, {
      maximumFractionDigits: rate >= 1 ? 4 : 8,
    })} ${toLabel}`;
  }, [to, payAmountNum, quoteOutNum, fromLabel, toLabel]);

  const detailsLine = useMemo(() => {
    if (quoteLoading) return "Fetching best price…";
    if (hasLiquidity && activeDex && exchangeRate) {
      const impact =
        priceImpactPct != null && priceImpactPct >= 0.1
          ? ` · ${priceImpactPct.toFixed(2)}% impact`
          : "";
      return `${exchangeRate} · ${dexLabel(activeDex)}${impact}`;
    }
    if (hasLiquidity === false && to) return quoteError ?? "No route found";
    return null;
  }, [
    quoteLoading,
    hasLiquidity,
    activeDex,
    exchangeRate,
    priceImpactPct,
    to,
    quoteError,
  ]);

  return (
    <div className="dex-swap-card">
      <div className="dex-swap-header">
        <h1 className="dex-swap-title">Swap</h1>
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="dex-swap-settings"
          aria-label="Settings"
        >
          <Settings2 size={16} />
          <span>{slippage}%</span>
        </button>
      </div>

      {showSettings && (
        <div className="dex-swap-settings-panel">
          {routeSelectable && (
            <div className="mb-3">
              <p className="dex-swap-settings-label">Route</p>
              <div className="dex-swap-chip-row">
                {ROUTE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDex(opt.id)}
                    className={`dex-swap-chip ${dex === opt.id ? "dex-swap-chip-on" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="dex-swap-settings-label">Slippage tolerance</p>
          <div className="dex-swap-chip-row">
            {SLIPPAGE_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlippage(s)}
                className={`dex-swap-chip ${slippage === s ? "dex-swap-chip-on" : ""}`}
              >
                {s}%
              </button>
            ))}
            <input
              type="text"
              inputMode="decimal"
              placeholder="Custom"
              aria-label="Custom slippage percent"
              value={isPresetSlippage(slippage) ? "" : slippage}
              onChange={(e) => {
                const next = sanitizeCustomSlippage(e.target.value);
                if (next) setSlippage(next);
              }}
              className={`dex-swap-chip dex-swap-chip-input ${!isPresetSlippage(slippage) ? "dex-swap-chip-on" : ""}`}
            />
          </div>
        </div>
      )}

      <div className="dex-swap-fields">
        <div className="dex-swap-field">
          <div className="dex-swap-field-top">
            <span className="dex-swap-field-label">Sell</span>
            {wallet && !guestMode && (
              <button
                type="button"
                onClick={() => setPct(-1, "MAX")}
                className="dex-swap-max"
              >
                Balance {formatTokenBalanceDisplay(fromBalance, fromDecimals)} · MAX
              </button>
            )}
          </div>
          <div className="dex-swap-field-body">
            <input
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="dex-swap-input"
            />
            <TokenSelect counter={from} onOpen={() => setPickerSide("from")} />
          </div>
          {payUsd != null && payUsd > 0 && (
            <p className="dex-swap-usd">{formatUsdSide(payUsd)}</p>
          )}
        </div>

        <div className="dex-swap-flip-wrap">
          <button
            type="button"
            onClick={flipPair}
            disabled={!to}
            className="dex-swap-flip"
            aria-label="Flip tokens"
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        <div className="dex-swap-field">
          <div className="dex-swap-field-top">
            <span className="dex-swap-field-label">Buy</span>
            {minReceive && hasLiquidity && !quoteLoading && to && (
              <span className="dex-swap-min">
                Min {minReceive} {toLabel}
              </span>
            )}
          </div>
          <div className="dex-swap-field-body">
            <p className="dex-swap-output">
              {quoteLoading ? "…" : quoteOut ?? "0"}
            </p>
            <TokenSelect
              counter={to}
              placeholder="Select"
              onOpen={() => setPickerSide("to")}
            />
          </div>
          {(receiveUsd != null && receiveUsd > 0) || quoteLoading ? (
            <p className="dex-swap-usd">
              {quoteLoading ? (
                <Loader2 size={12} className="inline animate-spin opacity-60" />
              ) : (
                formatUsdSide(receiveUsd)
              )}
            </p>
          ) : null}
        </div>
      </div>

      {detailsLine && (
        <p
          className={`dex-swap-details ${hasLiquidity === false ? "dex-swap-details-warn" : ""}`}
        >
          {detailsLine}
        </p>
      )}

      {aggregatorMissing && (
        <p className="dex-swap-details dex-swap-details-warn">
          Token-to-token swaps need 0x routing — try ETH as one side.
        </p>
      )}

      {needsImpactAck && hasLiquidity && (
        <label className="dex-swap-impact">
          <input
            type="checkbox"
            checked={highImpactAck}
            onChange={(e) => setHighImpactAck(e.target.checked)}
          />
          <span>High price impact — continue anyway</span>
        </label>
      )}

      <button
        type="button"
        onClick={onSwap}
        disabled={swapLoading || Boolean(wallet && !guestMode && !canSwap)}
        className="dex-swap-submit"
      >
        {swapLoading && <Loader2 size={18} className="animate-spin" />}
        {ctaLabel}
      </button>

      <p className="dex-swap-foot">
        {formatPlatformFeeLabel()} platform fee · Search or paste any Base{" "}
        <span className="font-mono">0x…</span> address · routes via Aerodrome / Uniswap /
        0x · Base mainnet
      </p>

      <TokenPickerDialog
        open={pickerSide === "from"}
        onClose={() => setPickerSide(null)}
        onSelect={(c) => pickToken("from", c)}
        excludeAddress={to?.kind === "token" ? to.address : null}
        title="Pay with"
      />
      <TokenPickerDialog
        open={pickerSide === "to"}
        onClose={() => setPickerSide(null)}
        onSelect={(c) => pickToken("to", c)}
        excludeAddress={from.kind === "token" ? from.address : null}
        title="Receive"
      />
    </div>
  );
}
