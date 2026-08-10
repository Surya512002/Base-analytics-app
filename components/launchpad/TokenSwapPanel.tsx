"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Settings2,
  Wallet,
  Zap,
} from "lucide-react";
import { formatUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { fetchSwapQuote, fetchProtectionStatus, type LaunchDex } from "@/lib/api/launchpad-client";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { captureTokenReferrerFromUrl, readTokenReferrer } from "@/lib/utils/referral";
import {
  aerodromeDepositUrl,
  aerodromeSwapUrl,
  dexLabel,
  dexscreenerTokenUrl,
  type SwapVenue,
} from "@/lib/launchpad/dex";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatSubscriptPrice, formatUsd } from "@/lib/launchpad/format";
import {
  computeSwapUsd,
  impliedTokenPriceUsd,
  isWethAddress,
} from "@/lib/launchpad/swap-display";
import { fetchTokenPairs } from "@/lib/api/launchpad-token-client";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { type SwapAsset } from "@/lib/launchpad/tokens-base";
import SeedLiquidityPanel from "@/components/launchpad/SeedLiquidityPanel";
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

const ROUTE_OPTIONS: { id: LaunchDex; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "aerodrome", label: "Aerodrome" },
  { id: "uniswap", label: "Uniswap" },
  { id: "slipstream", label: "Slipstream" },
];

const PCT_PRESETS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "MAX", pct: -1 },
] as const;

const SLIPPAGE_PRESETS = ["0.5", "1", "3", "5"];

/** Leave native ETH for gas when the user picks MAX on an ETH buy. */
const MAX_ETH_FRACTION = 0.97;
/** Sell MAX — leave dust to avoid rounding reverts. */
const MAX_TOKEN_FRACTION = 0.995;
/** Only warn on meaningful price impact (not pool size alone). */
const HIGH_IMPACT_PCT = 5;

/** Symbols that track the dollar closely enough to price at $1 without a feed. */
const DOLLAR_PEGGED = new Set(["USDC", "USDT", "DAI", "USDBC", "USDS", "USDE"]);

/** A sensible starting amount so the panel opens with a live quote. */
function defaultAmountFor(counter: SwapCounter): string {
  if (counter.kind === "eth") return "0.01";
  return DOLLAR_PEGGED.has(counter.symbol.toUpperCase()) ? "10" : "1";
}

function formatQuoteOut(amountOut: string, decimals: number): string {
  const n = Number(amountOut) / 10 ** decimals;
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
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

function TokenAvatar({ symbol, imageUrl }: { symbol: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="w-7 h-7 rounded-full object-cover border border-[var(--border-subtle)] shrink-0"
      />
    );
  }
  return <span className="swap-eth-icon">{symbol.slice(0, 2)}</span>;
}

/** The counter side is a button: any Base token can sit on it. */
function CounterPill({
  counter,
  onOpen,
}: {
  counter: SwapCounter;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="swap-token-pill"
      aria-label={`Change token — currently ${counterSymbol(counter)}`}
    >
      <CounterAvatar counter={counter} size={28} />
      <span>{counterSymbol(counter)}</span>
      <ChevronDown size={14} className="text-[var(--ink-dim)] shrink-0" />
    </button>
  );
}

function SwapUsdColumn({ usd, loading }: { usd: number | null; loading?: boolean }) {
  return (
    <div className="swap-usd-column">
      <span className="swap-usd-label">USD</span>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-[var(--ink-dim)] ml-auto" />
      ) : (
        <span className="swap-usd-value">{formatUsdSide(usd)}</span>
      )}
    </div>
  );
}

export default function TokenSwapPanel({
  app,
  token,
  guestMode,
  onRequestConnect,
}: {
  app: WalletAppState;
  token: LaunchedToken | null;
  guestMode?: boolean;
  onRequestConnect?: () => void;
}) {
  const { wallet, walletCore, swapLoading, handleTokenSwap, handleUnwrapWeth, showToast } = app;
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [counter, setCounter] = useState<SwapCounter>(ETH_COUNTER);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("1");
  const [dex, setDex] = useState<LaunchDex>("auto");
  const [showSettings, setShowSettings] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [minReceive, setMinReceive] = useState<string | null>(null);
  const [hasLiquidity, setHasLiquidity] = useState<boolean | null>(null);
  const [hasPool, setHasPool] = useState<boolean | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [activeDex, setActiveDex] = useState<SwapVenue | null>(null);
  const [quoteImpactBps, setQuoteImpactBps] = useState<number | null>(null);
  const [aggregatorReady, setAggregatorReady] = useState(true);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenBalanceRaw, setTokenBalanceRaw] = useState<bigint>(BigInt(0));
  const [wethBalance, setWethBalance] = useState(0);
  const [counterTokenBalance, setCounterTokenBalance] = useState(0);
  const [counterTokenUsd, setCounterTokenUsd] = useState<number | null>(null);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [ethUsd, setEthUsd] = useState(2500);
  const [antiSnipeActive, setAntiSnipeActive] = useState(false);
  const [antiSnipeMsg, setAntiSnipeMsg] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [poolLiquidityUsd, setPoolLiquidityUsd] = useState<number | null>(null);
  const [highImpactAck, setHighImpactAck] = useState(false);
  const [balanceTick, setBalanceTick] = useState(0);
  const [activePct, setActivePct] = useState<string | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const isWethToken = token ? isWethAddress(token.address) : false;

  /** A token can't be paired against itself, so that page falls back to ETH. */
  const effectiveCounter: SwapCounter =
    counter.kind === "token" &&
    token &&
    counter.address.toLowerCase() === token.address.toLowerCase()
      ? ETH_COUNTER
      : counter;

  const counterDecimals = counterDecimalsOf(effectiveCounter);
  const counterLabel = counterSymbol(effectiveCounter);

  /**
   * USD per unit of the counter asset, which anchors both sides of the trade.
   * Null for an unpriced token — the USD readouts then show a dash rather than
   * a number derived from nothing.
   */
  const counterUsd = useMemo(() => {
    if (effectiveCounter.kind === "eth") return ethUsd;
    const symbol = effectiveCounter.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(symbol)) return 1;
    if (symbol === "WETH") return ethUsd;
    return counterTokenUsd;
  }, [effectiveCounter, ethUsd, counterTokenUsd]);

  const counterBalance =
    effectiveCounter.kind === "eth"
      ? parseFloat(walletCore?.balance ?? wallet?.balance ?? "0") || 0
      : counterTokenBalance;

  const counterAssetParam: SwapAsset =
    effectiveCounter.kind === "eth" ? "eth" : "token";
  const counterTokenParam =
    effectiveCounter.kind === "token" ? effectiveCounter.address : null;

  useEffect(() => {
    if (!token) return;
    setTokenDecimals(token.decimals);
    let alive = true;
    void (async () => {
      try {
        const n = await fetchErc20Decimals(token.address as `0x${string}`, token.decimals);
        if (alive) setTokenDecimals(n);
      } catch {
        /* keep token.decimals */
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    captureTokenReferrerFromUrl(token.address);
    setReferrer(readTokenReferrer(token.address));
  }, [token]);

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
        return {
          human: Number.isFinite(human) ? human : 0,
          raw,
        };
      } catch {
        return { human: 0, raw: BigInt(0) };
      }
    },
    [wallet]
  );

  useEffect(() => {
    if (!token || !wallet) {
      setTokenBalance(0);
      setTokenBalanceRaw(BigInt(0));
      setWethBalance(0);
      setCounterTokenBalance(0);
      return;
    }
    const counterAddress =
      effectiveCounter.kind === "token"
        ? (effectiveCounter.address as `0x${string}`)
        : null;
    let alive = true;
    void (async () => {
      const [tok, weth, counterBal] = await Promise.all([
        readErc20Balance(token.address as `0x${string}`, tokenDecimals),
        readErc20Balance(WETH_BASE, 18),
        counterAddress
          ? readErc20Balance(counterAddress, counterDecimals)
          : Promise.resolve({ human: 0, raw: BigInt(0) }),
      ]);
      if (!alive) return;
      setTokenBalance(tok.human);
      setTokenBalanceRaw(tok.raw);
      setWethBalance(weth.human);
      setCounterTokenBalance(counterBal.human);
    })();
    return () => {
      alive = false;
    };
  }, [
    token,
    wallet,
    balanceTick,
    readErc20Balance,
    tokenDecimals,
    effectiveCounter,
    counterDecimals,
  ]);

  useEffect(() => {
    if (!token || !wallet) return;
    const id = window.setInterval(() => refreshBalances(), 20_000);
    return () => window.clearInterval(id);
  }, [token, wallet, refreshBalances]);

  useEffect(() => {
    const onFocus = () => refreshBalances();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshBalances]);

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

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchTokenPairs(token.address).then((d) => {
      if (!alive) return;
      const best = [...(d.pairs ?? [])].sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      setHasPool((d.pairs ?? []).some((p) => (p.liquidity?.usd ?? 0) > 0));
      setPoolLiquidityUsd(best?.liquidity?.usd ?? null);
      if (best?.priceUsd) setPriceUsd(parseFloat(best.priceUsd));
    });
    return () => {
      alive = false;
    };
  }, [token]);

  /** Price an arbitrary counter token so the USD readouts stay meaningful. */
  useEffect(() => {
    if (effectiveCounter.kind !== "token") {
      setCounterTokenUsd(null);
      return;
    }
    const symbol = effectiveCounter.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(symbol) || symbol === "WETH") {
      setCounterTokenUsd(null);
      return;
    }
    let alive = true;
    void fetchTokenPairs(effectiveCounter.address)
      .then((d) => {
        if (!alive) return;
        const best = [...(d.pairs ?? [])].sort(
          (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
        )[0];
        const price = best?.priceUsd ? parseFloat(best.priceUsd) : NaN;
        setCounterTokenUsd(Number.isFinite(price) && price > 0 ? price : null);
      })
      .catch(() => {
        if (alive) setCounterTokenUsd(null);
      });
    return () => {
      alive = false;
    };
  }, [effectiveCounter]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchProtectionStatus(token.address, direction)
      .then((s) => {
        if (!alive) return;
        setAntiSnipeActive(s.active);
        setAntiSnipeMsg(s.message ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, direction]);

  const quoteAmountDecimals =
    direction === "sell" ? tokenDecimals : counterDecimals;
  const quoteAmount = useMemo(
    () => sanitizeTokenAmountInput(amount, quoteAmountDecimals),
    [amount, quoteAmountDecimals]
  );

  useEffect(() => {
    if (!token || !quoteAmount || parseFloat(quoteAmount) <= 0) {
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
      const q = await fetchSwapQuote({
        token: token.address,
        direction,
        amount: quoteAmount,
        decimals: tokenDecimals,
        slippageBps: parseSlippageBps(slippage),
        dex,
        referrer,
        taker: wallet?.address,
        counterDecimals,
        payAsset: direction === "buy" ? counterAssetParam : "eth",
        receiveAsset: direction === "sell" ? counterAssetParam : "eth",
        payToken: direction === "buy" ? counterTokenParam : null,
        receiveToken: direction === "sell" ? counterTokenParam : null,
      });
      if (!alive) return;
      setQuoteLoading(false);
      setHasLiquidity(q.hasLiquidity);
      setQuoteError(q.hasLiquidity ? null : (q.error ?? null));
      setActiveDex(q.dex ?? null);
      setQuoteImpactBps(q.priceImpactBps ?? null);
      setAggregatorReady(q.aggregatorConfigured !== false);
      if (q.antiSnipe?.active) {
        setAntiSnipeActive(true);
        setAntiSnipeMsg(q.antiSnipe.message ?? null);
      }
      const outDec =
        q.outDecimals ?? (direction === "buy" ? tokenDecimals : counterDecimals);
      if (q.hasLiquidity && q.amountOut) {
        setQuoteOut(formatQuoteOut(q.amountOut, outDec));
        setMinReceive(
          q.amountOutMinimum ? formatQuoteOut(q.amountOutMinimum, outDec) : null
        );
      } else {
        setQuoteOut(null);
        setMinReceive(null);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [
    token,
    direction,
    amount,
    quoteAmount,
    slippage,
    dex,
    referrer,
    wallet?.address,
    tokenDecimals,
    counterDecimals,
    counterAssetParam,
    counterTokenParam,
  ]);

  const payAmountNum = parseFloat(amount);
  const quoteOutNum = quoteOut != null ? parseFloat(quoteOut) : null;

  const { payUsd, receiveUsd } = useMemo(
    () =>
      computeSwapUsd({
        direction,
        payAmount: payAmountNum,
        quoteOut: quoteOutNum,
        // 0 is rejected downstream, which is the intent: an unpriced counter
        // token yields no USD figure rather than a fabricated one.
        counterUsd: counterUsd ?? 0,
      }),
    [direction, payAmountNum, quoteOutNum, counterUsd]
  );

  const liveTokenPriceUsd = useMemo(() => {
    if (
      quoteOutNum == null ||
      !Number.isFinite(payAmountNum) ||
      payAmountNum <= 0 ||
      quoteOutNum <= 0
    ) {
      return priceUsd;
    }
    return (
      impliedTokenPriceUsd({
        direction,
        payAmount: payAmountNum,
        quoteOut: quoteOutNum,
        counterUsd: counterUsd ?? 0,
      }) ?? priceUsd
    );
  }, [direction, payAmountNum, quoteOutNum, counterUsd, priceUsd]);

  const exchangeRate = useMemo(() => {
    if (
      !Number.isFinite(payAmountNum) ||
      payAmountNum <= 0 ||
      quoteOutNum == null ||
      quoteOutNum <= 0
    ) {
      return null;
    }
    const rate = quoteOutNum / payAmountNum;
    if (direction === "buy") {
      return `1 ${counterLabel} = ${rate.toLocaleString(undefined, {
        maximumFractionDigits: rate >= 1 ? 4 : 8,
      })} ${token?.symbol ?? ""}`;
    }
    return `1 ${token?.symbol ?? ""} = ${rate.toLocaleString(undefined, {
      maximumFractionDigits: rate >= 1 ? 4 : 8,
    })} ${counterLabel}`;
  }, [payAmountNum, quoteOutNum, direction, token?.symbol, counterLabel]);

  /**
   * Measured by the quote API against the pool being traded. Null means it
   * could not be measured, so nothing is shown — a stale external price feed
   * is not a usable substitute and used to invent several percent of impact on
   * trades that had none.
   */
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
  }, [token?.address, direction, amount, dex]);

  const defaultBuyAmount = defaultAmountFor(effectiveCounter);

  const resetAmount = useCallback(
    (d: "buy" | "sell") => {
      setAmount(d === "buy" ? defaultBuyAmount : "");
      setQuoteOut(null);
      setMinReceive(null);
      setActivePct(null);
    },
    [defaultBuyAmount]
  );

  const setDirectionSafe = (d: "buy" | "sell") => {
    setDirection(d);
    resetAmount(d);
  };

  const pickCounter = (next: SwapCounter) => {
    if (sameCounter(next, effectiveCounter)) return;
    setCounter(next);
    setAmount(direction === "buy" ? defaultAmountFor(next) : "");
    setQuoteOut(null);
    setMinReceive(null);
    setActivePct(null);
  };

  const openPicker = () => setPickerOpen(true);

  const flipDirection = () => setDirectionSafe(direction === "buy" ? "sell" : "buy");

  const setPct = (pct: number, label: string) => {
    setActivePct(label);
    if (direction === "buy") {
      // Native ETH doubles as the gas token, so MAX has to leave a buffer.
      const fraction =
        pct < 0 ? (effectiveCounter.kind === "eth" ? MAX_ETH_FRACTION : 1) : pct;
      const v = counterBalance * fraction;
      setAmount(v > 0 ? formatTokenInputAmount(v, counterDecimals) : "0");
    } else {
      const fraction = pct < 0 ? MAX_TOKEN_FRACTION : pct;
      const nextAmount =
        tokenBalanceRaw > BigInt(0)
          ? amountFromRawBalanceFraction(tokenBalanceRaw, tokenDecimals, fraction)
          : amountFromBalanceFraction(tokenBalance, tokenDecimals, fraction);
      setAmount(nextAmount);
    }
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
    if (!token) return;
    if (needsImpactAck && !highImpactAck) {
      showToast("Check the box to confirm high price impact", "");
      return;
    }
    if (guestMode || !wallet) {
      onRequestConnect?.();
      return;
    }
    if (!hasLiquidity) {
      showToast(quoteError || "No swap route — try Aerodrome or wait for indexing", "");
      return;
    }
    const ok = await handleTokenSwap({
      token: token.address,
      symbol: token.symbol,
      decimals: tokenDecimals,
      direction,
      amount: sanitizeTokenAmountInput(amount, quoteAmountDecimals) || amount,
      slippageBps: parseSlippageBps(slippage),
      dex,
      referrer,
      counterDecimals,
      payAsset: direction === "buy" ? counterAssetParam : "eth",
      receiveAsset: direction === "sell" ? counterAssetParam : "eth",
      payToken: direction === "buy" ? counterTokenParam : null,
      receiveToken: direction === "sell" ? counterTokenParam : null,
    });
    if (ok) {
      resetAmount(direction);
      refreshBalances();
      window.setTimeout(refreshBalances, 2500);
      window.setTimeout(refreshBalances, 8000);
    }
  };

  const onUnwrapWeth = async () => {
    const ok = await handleUnwrapWeth();
    if (ok) {
      refreshBalances();
      window.setTimeout(refreshBalances, 3000);
    }
  };

  if (!token) {
    return (
      <div className="swap-panel p-8 text-center text-sm text-[var(--ink-dim)]">
        Select a token to trade
      </div>
    );
  }

  const showLiquidityPanel = hasPool === false && Boolean(wallet) && !guestMode;
  const swapReady = hasPool !== false || hasLiquidity === true || tokenBalanceRaw > BigInt(0);
  const slippageValid = parseSlippageBps(slippage) > 0;
  const paySymbol = direction === "buy" ? counterLabel : token.symbol;
  const receiveSymbol = direction === "buy" ? token.symbol : counterLabel;
  const payBalance = direction === "buy" ? counterBalance : tokenBalance;
  const payBalanceDecimals = direction === "buy" ? counterDecimals : tokenDecimals;
  const insufficientBalance =
    Boolean(wallet) &&
    !guestMode &&
    Number.isFinite(payAmountNum) &&
    payAmountNum > 0 &&
    payAmountNum > payBalance;

  /**
   * Direct Uniswap/Aerodrome/Slipstream routes only cover the ETH pair; every
   * other counter token is routed by the 0x aggregator, so picking a venue by
   * hand is meaningless there and the swap is blocked if 0x is unconfigured.
   */
  const needsAggregator = effectiveCounter.kind !== "eth";
  const aggregatorMissing = needsAggregator && !aggregatorReady;
  const routeSelectable = !needsAggregator;

  const canSwap =
    Boolean(amount) &&
    payAmountNum > 0 &&
    slippageValid &&
    hasLiquidity &&
    !insufficientBalance &&
    !aggregatorMissing &&
    !(needsImpactAck && !highImpactAck) &&
    !(antiSnipeActive && direction === "buy" && !guestMode);

  const statusLabel = quoteLoading
    ? "Getting price…"
    : hasLiquidity
      ? "Ready"
      : hasLiquidity === false
        ? "No route"
        : "Enter amount";

  const statusTone = quoteLoading
    ? "swap-status-loading"
    : hasLiquidity
      ? "swap-status-ready"
      : hasLiquidity === false
        ? "swap-status-warn"
        : "swap-status-idle";

  const ctaLabel = (() => {
    if (guestMode || !wallet) return "Connect wallet";
    if (swapLoading) return "Confirm in wallet…";
    if (!amount || payAmountNum <= 0) return "Enter an amount";
    if (insufficientBalance) return `Not enough ${paySymbol}`;
    if (aggregatorMissing) return `${counterLabel} routing unavailable`;
    if (!hasLiquidity) return "No route available";
    if (needsImpactAck && !highImpactAck) return "Confirm price impact";
    if (antiSnipeActive && direction === "buy") return "Buys paused";
    if (payUsd != null && payUsd > 0) {
      return direction === "buy"
        ? `Buy ${formatUsd(payUsd)} of ${token.symbol}`
        : `Sell ${formatUsd(payUsd)} of ${token.symbol}`;
    }
    return direction === "buy" ? `Buy ${token.symbol}` : `Sell ${token.symbol}`;
  })();

  return (
    <div className="swap-panel swap-panel-lg">
      <div className="swap-panel-inner">
        <div className="swap-mode-tabs">
          {(["buy", "sell"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirectionSafe(d)}
              className={`swap-mode-tab ${direction === d ? (d === "buy" ? "swap-mode-buy-active" : "swap-mode-sell-active") : ""}`}
            >
              {d === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className={`swap-status-pill ${statusTone}`}>
            {quoteLoading ? (
              <Loader2 size={12} className="animate-spin shrink-0" />
            ) : hasLiquidity ? (
              <CheckCircle2 size={12} className="shrink-0" />
            ) : (
              <Zap size={12} className="shrink-0" />
            )}
            <span>{statusLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="swap-settings-btn"
            aria-label="Swap settings"
          >
            <Settings2 size={15} />
            <span>{slippage}% slip</span>
          </button>
        </div>

        {wallet && !guestMode && (
          <div className="swap-wallet-row swap-wallet-row-multi">
            <Wallet size={14} className="text-[var(--ink-dim)] shrink-0" />
            <span>
              <span className="text-[var(--ink-muted)] font-semibold">{ethBalance.toFixed(4)}</span>{" "}
              <span className="text-[var(--ink-dim)]">ETH</span>
            </span>
            {effectiveCounter.kind === "token" && counterTokenBalance > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span>
                  <span className="text-[var(--ink-muted)] font-semibold">
                    {formatTokenBalanceDisplay(counterTokenBalance, counterDecimals)}
                  </span>{" "}
                  <span className="text-[var(--ink-dim)]">{counterLabel}</span>
                </span>
              </>
            )}
            {!isWethToken && tokenBalance > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span>
                  <span className="text-[var(--ink-muted)] font-semibold">
                    {formatTokenBalanceDisplay(tokenBalance, tokenDecimals)}
                  </span>{" "}
                  <span className="text-[var(--ink-dim)]">{token.symbol}</span>
                </span>
              </>
            )}
          </div>
        )}

        {wethBalance > 0 && !isWethToken && wallet && !guestMode && (
          <div className="swap-alert swap-alert-warn flex items-center justify-between gap-3">
            <span>
              {wethBalance.toFixed(4)} WETH sitting idle — convert it to spendable ETH.
            </span>
            <button
              type="button"
              onClick={onUnwrapWeth}
              disabled={swapLoading}
              className="swap-route-chip shrink-0"
            >
              Unwrap
            </button>
          </div>
        )}

        {showSettings && (
          <div className="swap-settings-panel">
            {routeSelectable && (
              <>
                <p className="swap-settings-label">Route</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {ROUTE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDex(opt.id)}
                      className={`swap-route-chip ${dex === opt.id ? "swap-route-chip-active" : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="swap-settings-label">Slippage</p>
            <div className="flex gap-2">
              {SLIPPAGE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlippage(s)}
                  className={`swap-route-chip flex-1 ${slippage === s ? "swap-route-chip-active" : ""}`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
        )}

        {showLiquidityPanel && (
          <SeedLiquidityPanel
            app={app}
            token={token}
            tokenBalance={tokenBalance}
            onSeeded={() => {
              setHasPool(true);
              setHasLiquidity(null);
              setAmount(direction === "buy" ? defaultBuyAmount : "");
            }}
          />
        )}

        {swapReady && (
          <>
            <div className="swap-token-box">
              <div className="swap-field-header">
                <span className="swap-field-label">You pay</span>
                <span className="swap-balance-hint">
                  Balance {formatTokenBalanceDisplay(payBalance, payBalanceDecimals)}{" "}
                  {paySymbol}
                </span>
              </div>
              <div className="swap-amount-row">
                {direction === "sell" ? (
                  <div className="swap-token-pill">
                    <TokenAvatar symbol={token.symbol} imageUrl={token.imageUrl} />
                    <span>{paySymbol}</span>
                  </div>
                ) : (
                  <CounterPill counter={effectiveCounter} onOpen={openPicker} />
                )}
                <input
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className="swap-amount-input"
                />
                <SwapUsdColumn usd={payUsd} />
              </div>
            </div>

            <div className="swap-presets">
              {PCT_PRESETS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setPct(b.pct, b.label)}
                  className={`swap-preset-btn ${activePct === b.label ? "swap-preset-active" : ""}`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="swap-mid-row">
              <button
                type="button"
                onClick={flipDirection}
                className="swap-flip-btn"
                aria-label="Flip direction"
              >
                <ArrowDownUp size={20} />
              </button>
              {exchangeRate && hasLiquidity && !quoteLoading && (
                <p className="swap-rate-line">{exchangeRate}</p>
              )}
            </div>

            <div className="swap-token-box swap-token-box-receive">
              <div className="swap-field-header">
                <span className="swap-field-label">You receive</span>
                {minReceive && hasLiquidity && !quoteLoading && (
                  <span className="swap-balance-hint">
                    Min {minReceive} {receiveSymbol}
                  </span>
                )}
              </div>
              <div className="swap-amount-row">
                {direction === "buy" ? (
                  <div className="swap-token-pill">
                    <TokenAvatar symbol={token.symbol} imageUrl={token.imageUrl} />
                    <span>{receiveSymbol}</span>
                  </div>
                ) : (
                  <CounterPill counter={effectiveCounter} onOpen={openPicker} />
                )}
                <p className="swap-amount-display">{quoteLoading ? "…" : quoteOut ?? "0"}</p>
                <SwapUsdColumn usd={receiveUsd} loading={quoteLoading} />
              </div>
            </div>

            {hasLiquidity && activeDex && !quoteLoading && (
              <div className="swap-summary-strip">
                <span>
                  Route <strong>{dexLabel(activeDex)}</strong>
                </span>
                <span className="swap-summary-dot">·</span>
                <span>{formatPlatformFeeLabel()} platform fee</span>
                {priceImpactPct != null && (
                  <>
                    <span className="swap-summary-dot">·</span>
                    <span
                      className={
                        priceImpactPct >= HIGH_IMPACT_PCT ? "text-rose-300 font-semibold" : ""
                      }
                    >
                      {priceImpactPct.toFixed(1)}% impact
                    </span>
                  </>
                )}
              </div>
            )}

            {(liveTokenPriceUsd != null || poolLiquidityUsd != null) && (
              <p className="swap-meta-line">
                {liveTokenPriceUsd != null && liveTokenPriceUsd > 0 && (
                  <>
                    1 {token.symbol} ≈ {formatSubscriptPrice(liveTokenPriceUsd)}
                  </>
                )}
                {poolLiquidityUsd != null && poolLiquidityUsd > 0 && (
                  <>
                    {liveTokenPriceUsd != null && liveTokenPriceUsd > 0 ? " · " : ""}
                    {formatUsd(poolLiquidityUsd)} pool liquidity
                  </>
                )}
              </p>
            )}

            {direction === "buy" && activePct === "MAX" && effectiveCounter.kind === "eth" && (
              <p className="swap-gas-hint">MAX keeps a small ETH buffer for network fees.</p>
            )}

            {antiSnipeActive && direction === "buy" && antiSnipeMsg && (
              <div className="swap-alert swap-alert-warn">{antiSnipeMsg}</div>
            )}

            {aggregatorMissing && (
              <div className="swap-alert swap-alert-warn">
                Trading against {counterLabel} needs the 0x aggregator, which is not
                configured. Switch to ETH.
              </div>
            )}

            {hasLiquidity === false && !quoteLoading && !aggregatorMissing && (
              <div className="swap-alert swap-alert-warn">
                {quoteError ??
                  "No route found on Aerodrome, Uniswap, or Slipstream yet."}{" "}
                <a
                  href={aerodromeSwapUrl(token.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ink)] underline inline-flex items-center gap-1"
                >
                  Aerodrome <ExternalLink size={10} />
                </a>
              </div>
            )}

            {needsImpactAck && hasLiquidity && (
              <label className="swap-impact-ack">
                <input
                  type="checkbox"
                  checked={highImpactAck}
                  onChange={(e) => setHighImpactAck(e.target.checked)}
                />
                <span>High price impact — I understand and want to continue</span>
              </label>
            )}

            <div className="swap-cta-wrap">
              <button
                type="button"
                onClick={onSwap}
                disabled={swapLoading || Boolean(wallet && !guestMode && !canSwap)}
                className={`swap-submit-btn ${direction === "buy" ? "swap-submit-buy" : "swap-submit-sell"}`}
              >
                {swapLoading && <Loader2 size={20} className="animate-spin" />}
                {ctaLabel}
              </button>
            </div>

            <div className="swap-footer-links">
              <a href={aerodromeSwapUrl(token.address)} target="_blank" rel="noopener noreferrer">
                Aerodrome <ExternalLink size={10} />
              </a>
              <a
                href={aerodromeDepositUrl(token.address)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Add liquidity <ExternalLink size={10} />
              </a>
              <a
                href={dexscreenerTokenUrl(token.address)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chart <ExternalLink size={10} />
              </a>
            </div>
          </>
        )}
      </div>

      <TokenPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={pickCounter}
        excludeAddress={token.address}
        title={direction === "buy" ? "Pay with" : "Receive"}
      />
    </div>
  );
}
