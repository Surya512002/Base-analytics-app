"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDownUp,
  ChevronDown,
  Loader2,
  Settings2,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { SWAP_ROUTER_02 } from "@/lib/launchpad/uniswap";
import { AERODROME_ROUTER } from "@/lib/launchpad/aerodrome";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { buildContractCall } from "@/lib/utils/tx";
import { encodeB20ApproveCalldata } from "@/lib/b20/encode";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { fetchSwapQuote, type LaunchDex } from "@/lib/api/launchpad-client";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { captureTokenReferrerFromUrl, readTokenReferrer } from "@/lib/utils/referral";
import { dexLabel, type SwapVenue } from "@/lib/launchpad/dex";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatUsd, formatTokenAmount } from "@/lib/launchpad/format";
import { computeSwapUsd } from "@/lib/launchpad/swap-display";
import { getStockBaselineNav } from "@/lib/stocks/coinbase-api";
import { getStockTradability } from "@/lib/stocks/stock-tradability";
import { DEFAULT_STOCK_COMPLIANCE } from "@/lib/stocks/compliance";
import { fetchTokenPairs } from "@/lib/api/launchpad-token-client";
import {
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
  sanitizeTokenAmountInput,
} from "@/lib/launchpad/token-amount";
import {
  launchedToCounter,
  normalizeEthWeth,
  resolveDexSwapRoute,
} from "@/lib/launchpad/dex-swap-params";
import { enrichSwapCounter } from "@/lib/launchpad/token-logo";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";
import TokenSelectorModal from "./TokenSelectorModal";
import type { TokenHolding } from "@/hooks/useWalletHoldings";
import { useCompliance } from "@/hooks/useCompliance";
import StockRiskModal from "@/components/compliance/StockRiskModal";
import { getTokenizedStockBySymbol } from "@/lib/stocks/tokenized-stocks-registry";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

const ROUTE_OPTIONS: { id: LaunchDex; label: string }[] = [
  { id: "auto", label: "Auto Best" },
  { id: "aerodrome", label: "Aerodrome" },
  { id: "uniswap", label: "Uniswap" },
  { id: "slipstream", label: "Slipstream" },
  { id: "o1", label: "o1 Router" },
];

const SLIPPAGE_PRESETS = ["0.5", "1", "3"];
const MAX_ETH_FRACTION = 0.97;
const MAX_TOKEN_FRACTION = 0.995;
const DOLLAR_PEGGED = new Set(["USDC", "USDT", "DAI", "USDBC", "USDbC", "USDS", "USDE"]);
const QUOTE_REFRESH_INTERVAL_SEC = 15;

function defaultFromAmount(counter: SwapCounter): string {
  if (counter.kind === "eth") return "0.01";
  const sym = counter.symbol.toUpperCase();
  return DOLLAR_PEGGED.has(sym) ? "10" : "1";
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

interface DexSwapCardProps {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  prefillToken?: LaunchedToken | null;
  prefillReceiveCounter?: SwapCounter | null;
  onPrefillReceiveApplied?: () => void;
  prefillFromCounter?: SwapCounter | null;
  onPrefillFromApplied?: () => void;
  holdings?: TokenHolding[];
  currentBuyToken?: SwapCounter | null;
  onBuyTokenChange?: (counter: SwapCounter | null) => void;
  loadingBuyMetadata?: boolean;
  loadingSellMetadata?: boolean;
  initialAmount?: string | null;
}

export default function DexSwapCard({
  app,
  guestMode = false,
  onRequestConnect,
  prefillToken,
  prefillReceiveCounter,
  onPrefillReceiveApplied,
  prefillFromCounter,
  onPrefillFromApplied,
  holdings = [],
  currentBuyToken,
  onBuyTokenChange,
  loadingBuyMetadata = false,
  loadingSellMetadata: _loadingSellMetadata = false,
  initialAmount,
}: DexSwapCardProps) {
  const { wallet, walletCore, swapLoading, handleTokenSwap, showToast } = app;

  const [from, setFrom] = useState<SwapCounter>(ETH_COUNTER);
  const [to, setTo] = useState<SwapCounter | null>(currentBuyToken ?? null);
  const [pickerSide, setPickerSide] = useState<"from" | "to" | null>(null);
  const [amount, setAmount] = useState(initialAmount && parseFloat(initialAmount) > 0 ? initialAmount : "0.01");
  const [slippage, setSlippage] = useState("0.5");

  useEffect(() => {
    if (initialAmount && parseFloat(initialAmount) > 0) {
      setAmount(initialAmount);
    }
  }, [initialAmount]);
  const [dex, setDex] = useState<LaunchDex>("auto");
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [invertRate, setInvertRate] = useState(false);
  const [flipDegree, setFlipDegree] = useState(0);

  // Quote State
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [minReceive, setMinReceive] = useState<string | null>(null);
  const [hasLiquidity, setHasLiquidity] = useState<boolean | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [activeDex, setActiveDex] = useState<SwapVenue | null>(null);
  const [quoteImpactBps, setQuoteImpactBps] = useState<number | null>(null);
  const [isLaunchedToken, setIsLaunchedToken] = useState(false);
  const [creatorAddress, setCreatorAddress] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);

  // 15-second Refresh Countdown Ring
  const [countdown, setCountdown] = useState(QUOTE_REFRESH_INTERVAL_SEC);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Balances & Prices
  const [balanceTick, setBalanceTick] = useState(0);
  const [fromBalance, setFromBalance] = useState(0);
  const [fromBalanceRaw, setFromBalanceRaw] = useState<bigint>(BigInt(0));
  const [fromAllowance, setFromAllowance] = useState<bigint>(BigInt(0));
  const [isApproving, setIsApproving] = useState(false);
  const [ethUsd, setEthUsd] = useState(2500);
  const [fromTokenUsd, setFromTokenUsd] = useState<number | null>(null);
  const [pageTokenUsd, setPageTokenUsd] = useState<number | null>(null);
  const [pageDecimals, setPageDecimals] = useState(18);

  // Transaction Status Animation State
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);

  // Sync with external buy token pick (e.g. from Popular chips)
  useEffect(() => {
    if (currentBuyToken && (!to || !sameCounter(currentBuyToken, to))) {
      setTo(currentBuyToken);
    }
  }, [currentBuyToken]);

  // Sync `to` back to parent
  useEffect(() => {
    onBuyTokenChange?.(to);
  }, [to, onBuyTokenChange]);

  const route = useMemo(() => {
    if (!to) return null;
    return resolveDexSwapRoute(from, to);
  }, [from, to]);

  const fromDecimals = counterDecimalsOf(from);

  // Handle prefill tokens
  useEffect(() => {
    if (!prefillFromCounter) return;
    setFrom(prefillFromCounter);
    onPrefillFromApplied?.();
  }, [prefillFromCounter, onPrefillFromApplied]);

  useEffect(() => {
    if (!prefillReceiveCounter) return;
    setTo(prefillReceiveCounter);
    onPrefillReceiveApplied?.();
  }, [prefillReceiveCounter, onPrefillReceiveApplied]);

  useEffect(() => {
    if (!prefillToken) return;
    const nextTo = launchedToCounter(prefillToken);
    if (sameCounter(normalizeEthWeth(nextTo), normalizeEthWeth(from))) {
      setFrom(ETH_COUNTER);
    }
    setTo(nextTo);
    setAmount(defaultFromAmount(from));
    setIsLaunchedToken(true);
    setCreatorAddress(prefillToken.creator ?? null);
    captureTokenReferrerFromUrl(prefillToken.address);
    setReferrer(readTokenReferrer(prefillToken.address));
  }, [prefillToken?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!route?.pageToken.address) return;
    captureTokenReferrerFromUrl(route.pageToken.address);
    setReferrer(readTokenReferrer(route.pageToken.address));
  }, [route?.pageToken.address]);

  // Fetch ETH price
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

  // Fetch token decimals for page token
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

  // Fetch USD prices for from and to tokens
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

  const fromUsd = useMemo(() => {
    if (from.kind === "eth") return ethUsd;
    const sym = from.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(sym)) return 1;
    if (sym === "WETH") return ethUsd;
    const stockNav = getStockBaselineNav(from.address) ?? getStockBaselineNav(from.symbol);
    if (stockNav && stockNav > 0) return stockNav;
    return fromTokenUsd;
  }, [from, ethUsd, fromTokenUsd]);

  const toUsd = useMemo(() => {
    if (!to) return null;
    if (to.kind === "eth") return ethUsd;
    const sym = to.symbol.toUpperCase();
    if (DOLLAR_PEGGED.has(sym)) return 1;
    if (sym === "WETH") return ethUsd;
    const stockNav = getStockBaselineNav(to.address) ?? getStockBaselineNav(to.symbol);
    if (stockNav && stockNav > 0) return stockNav;
    return pageTokenUsd;
  }, [to, ethUsd, pageTokenUsd]);

  const counterUsd = useMemo(() => {
    if (!route) return 0;
    return (route.direction === "buy" ? fromUsd : toUsd) ?? 0;
  }, [route?.direction, fromUsd, toUsd]);

  const ethBalance = useMemo(() => {
    const bal = walletCore?.balance ?? wallet?.balance;
    if (!bal) return 0;
    const n = parseFloat(bal);
    return Number.isFinite(n) ? n : 0;
  }, [walletCore?.balance, wallet?.balance]);

  // Read onchain balance for sell asset
  useEffect(() => {
    if (!wallet) {
      setFromBalance(0);
      setFromBalanceRaw(BigInt(0));
      return;
    }
    let alive = true;
    void (async () => {
      if (from.kind === "eth") {
        try {
          const pub = createBasePublicClient();
          const wei = await pub.getBalance({ address: wallet.address as `0x${string}` });
          const human = parseFloat(formatUnits(wei, 18));
          if (!alive) return;
          setFromBalance(Number.isFinite(human) ? human : ethBalance);
          setFromBalanceRaw(wei);
        } catch {
          if (!alive) return;
          setFromBalance(ethBalance);
          setFromBalanceRaw(BigInt(0));
        }
        return;
      }
      try {
        const pub = createBasePublicClient();
        const raw = await pub.readContract({
          address: from.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [wallet.address as `0x${string}`],
        });
        const human = parseFloat(formatUnits(raw, fromDecimals));
        if (!alive) return;
        setFromBalance(Number.isFinite(human) ? human : 0);
        setFromBalanceRaw(raw);

        // Check allowance for router (SWAP_ROUTER_02 or AERODROME_ROUTER)
        const targetSpender = (activeDex === "aerodrome" ? AERODROME_ROUTER : SWAP_ROUTER_02) as `0x${string}`;
        const allowance = await pub.readContract({
          address: from.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [wallet.address as `0x${string}`, targetSpender],
        }).catch(() => BigInt(0));
        if (alive) {
          setFromAllowance(allowance);
        }
      } catch {
        if (!alive) return;
        setFromBalance(0);
        setFromBalanceRaw(BigInt(0));
        setFromAllowance(BigInt(0));
      }
    })();
    return () => {
      alive = false;
    };
  }, [wallet, from, fromDecimals, ethBalance, balanceTick]);

  const quoteAmountDecimals =
    route?.direction === "sell" ? pageDecimals : route?.counterDecimals ?? fromDecimals;
  const quoteAmount = useMemo(
    () => sanitizeTokenAmountInput(amount, quoteAmountDecimals),
    [amount, quoteAmountDecimals]
  );

  // Fetch quote
  const executeQuoteFetch = useCallback(
    async (isBackground = false) => {
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

      if (!isBackground) setQuoteLoading(true);

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

        setQuoteLoading(false);
        setHasLiquidity(q.hasLiquidity);
        setQuoteError(q.hasLiquidity ? null : q.error ?? "No route with sufficient liquidity");
        setActiveDex(q.dex ?? null);
        setQuoteImpactBps(q.priceImpactBps ?? null);
        if (q.isLaunchedToken) setIsLaunchedToken(true);
        if (q.creator) setCreatorAddress(q.creator);

        const outDec =
          q.outDecimals ?? (route.direction === "buy" ? pageDecimals : route.counterDecimals);
        if (q.hasLiquidity && q.amountOut) {
          setQuoteOut(formatTokenAmount(q.amountOut, outDec));
          setMinReceive(
            q.amountOutMinimum ? formatTokenAmount(q.amountOutMinimum, outDec) : null
          );
        } else {
          setQuoteOut(null);
          setMinReceive(null);
        }
        setCountdown(QUOTE_REFRESH_INTERVAL_SEC);
      } catch {
        setQuoteLoading(false);
        setHasLiquidity(false);
        setQuoteError("Network error — retrying shortly");
      }
    },
    [route, quoteAmount, pageDecimals, slippage, dex, referrer, wallet?.address]
  );

  // Debounced quote fetch when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      void executeQuoteFetch(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [executeQuoteFetch]);

  // 15-second auto-refresh countdown
  useEffect(() => {
    if (!route || !quoteAmount || parseFloat(quoteAmount) <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void executeQuoteFetch(true);
          return QUOTE_REFRESH_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [route, quoteAmount, executeQuoteFetch]);

  // Flip Sell and Buy
  const flipPair = () => {
    if (!to) return;
    setFlipDegree((d) => d + 180);
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
    setAmount(defaultFromAmount(nextFrom));
    setQuoteOut(null);
    setMinReceive(null);
  };

  const handleSetPct = (fraction: number) => {
    const effFraction =
      fraction < 0
        ? from.kind === "eth"
          ? MAX_ETH_FRACTION
          : fromBalanceRaw > BigInt(0)
            ? MAX_TOKEN_FRACTION
            : 1
        : fraction;

    const nextAmount =
      from.kind !== "eth" && fromBalanceRaw > BigInt(0)
        ? amountFromRawBalanceFraction(fromBalanceRaw, fromDecimals, effFraction)
        : amountFromBalanceFraction(fromBalance, fromDecimals, effFraction);
    setAmount(nextAmount);
  };

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

  const insufficientBalance =
    Boolean(wallet) &&
    !guestMode &&
    Number.isFinite(payAmountNum) &&
    payAmountNum > 0 &&
    payAmountNum > fromBalance;

  const stockTradability = useMemo(() => {
    if (to && to.kind === "token" && to.symbol.endsWith("c")) {
      return getStockTradability(to.address);
    }
    if (from && from.kind === "token" && from.symbol.endsWith("c")) {
      return getStockTradability(from.address);
    }
    return null;
  }, [to, from]);

  const compliance = useCompliance();

  const isStockToken = useCallback((counter: SwapCounter | null | undefined): boolean => {
    if (!counter || counter.kind !== "token") return false;
    return counter.symbol.endsWith("c") || !!getTokenizedStockBySymbol(counter.symbol);
  }, []);

  const isStockBuy = isStockToken(to);
  const isStockSell = isStockToken(from);
  const isStockInvolved = isStockBuy || isStockSell;
  const isStockSwapDisabled = !compliance.status.features["stocks.swap"];
  const isStockBuyRestricted =
    isStockBuy && (isStockSwapDisabled || (compliance.isRestricted && !compliance.canEnter));

  // Primary Action Button Label & State
  const buttonState = useMemo(() => {
    if (guestMode || !wallet) {
      return { label: "Connect wallet", disabled: false, action: "connect" };
    }
    if (!to) {
      return { label: "Select buy token", disabled: true, action: "select_token" };
    }
    if (isStockBuyRestricted) {
      if (isStockSwapDisabled) {
        return { label: "Stock Swaps Temporarily Disabled", disabled: true, action: "swap_disabled" };
      }
      return { label: "Tokenized stock features are not available in your region", disabled: true, action: "region_restricted" };
    }
    if (stockTradability && stockTradability.status === "no_pool") {
      return { label: "No DEX Liquidity Pool Yet", disabled: true, action: "no_pool" };
    }
    if (stockTradability && stockTradability.status === "restricted") {
      return { label: "Transfers Restricted", disabled: true, action: "restricted" };
    }
    if (!amount || payAmountNum <= 0) {
      return { label: "Enter an amount", disabled: true, action: "enter_amount" };
    }
    if (insufficientBalance) {
      return { label: `Insufficient ${counterSymbol(from)}`, disabled: true, action: "insufficient" };
    }
    if (quoteLoading && !quoteOut) {
      return { label: "Fetching best route…", disabled: true, action: "loading_quote" };
    }
    if (hasLiquidity === false) {
      return { label: "No Route Available", disabled: true, action: "no_route" };
    }
    if (swapLoading) {
      return { label: "Confirming in wallet…", disabled: true, action: "confirming" };
    }

    // Two-step approval check for non-native tokens in EOA wallets
    const isEoa = app.connType !== "baseAccount" && app.connType !== "farcaster";
    const requiredRaw = parseUnits(sanitizeTokenAmountInput(amount, fromDecimals) || "0", fromDecimals);
    const needsApprove = from.kind !== "eth" && isEoa && fromAllowance < requiredRaw;

    if (needsApprove) {
      if (isApproving) {
        return { label: `Approving ${counterSymbol(from)}…`, disabled: true, action: "approving" };
      }
      return {
        label: `Step 1/2 · Approve ${counterSymbol(from)}`,
        disabled: false,
        action: "approve",
      };
    }

    const swapPrefix = from.kind !== "eth" && isEoa ? "Step 2/2 · " : "";
    return { label: `${swapPrefix}Swap ${counterSymbol(from)} → ${counterSymbol(to)}`, disabled: false, action: "swap" };
  }, [
    guestMode,
    wallet,
    to,
    isStockBuyRestricted,
    isStockSwapDisabled,
    stockTradability,
    amount,
    payAmountNum,
    insufficientBalance,
    quoteLoading,
    quoteOut,
    hasLiquidity,
    swapLoading,
    from,
    fromDecimals,
    fromAllowance,
    isApproving,
    app.connType,
  ]);

  // Execute Swap or Approval
  const handleSwap = async () => {
    if (buttonState.action === "connect") {
      onRequestConnect?.();
      return;
    }

    // Step 1: Explicit ERC-20 approval
    if (buttonState.action === "approve") {
      if (!from || from.kind === "eth" || !wallet) return;
      try {
        setIsApproving(true);
        const targetSpender = (activeDex === "aerodrome" ? AERODROME_ROUTER : SWAP_ROUTER_02) as `0x${string}`;
        const connType = app.connType ?? "injected";
        const call = buildContractCall(
          from.address as `0x${string}`,
          encodeB20ApproveCalldata(targetSpender, maxUint256)
        );
        const txHash = await sendAppTransactions(connType, wallet.address, [call]);
        if (txHash) {
          setFromAllowance(maxUint256);
          showToast(`✅ ${counterSymbol(from)} approved! Ready to swap.`, "");
        }
      } catch (err: unknown) {
        console.error("Token approval failed:", err);
        const msg = err instanceof Error ? err.message : "Approval failed";
        if (!msg.toLowerCase().includes("reject") && !msg.toLowerCase().includes("denied")) {
          showToast("Approval failed — retry or check wallet", "");
        }
      } finally {
        setIsApproving(false);
      }
      return;
    }

    if (!route || !to || buttonState.disabled) return;

    // Check risk acknowledgement for stock swaps
    if (isStockInvolved && !compliance.hasAcknowledged) {
      compliance.openModal();
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
      setTxSuccessHash("confirmed");
      setAmount(defaultFromAmount(from));
      setQuoteOut(null);
      setBalanceTick((t) => t + 1);
      setTimeout(() => setBalanceTick((t) => t + 1), 3000);
      setTimeout(() => setTxSuccessHash(null), 8000);
    }
  };

  // Invertable Exchange Rate String
  const exchangeRateString = useMemo(() => {
    if (!to || !payAmountNum || !quoteOutNum || payAmountNum <= 0 || quoteOutNum <= 0) return null;
    const fromSym = counterSymbol(from);
    const toSym = counterSymbol(to);

    if (invertRate) {
      const rate = payAmountNum / quoteOutNum;
      return `1 ${toSym} ≈ ${formatTokenAmount(rate, fromDecimals)} ${fromSym}`;
    }
    const rate = quoteOutNum / payAmountNum;
    return `1 ${fromSym} ≈ ${formatTokenAmount(rate, counterDecimalsOf(to))} ${toSym}`;
  }, [to, from, payAmountNum, quoteOutNum, invertRate, fromDecimals]);

  // Price Impact Color Class
  const priceImpactBadge = useMemo(() => {
    if (priceImpactPct == null) return null;
    if (priceImpactPct < 1) {
      return {
        label: `< 1%`,
        colorClass: "text-emerald-600 dark:text-emerald-400 font-semibold",
      };
    }
    if (priceImpactPct <= 3) {
      return {
        label: `${priceImpactPct.toFixed(2)}%`,
        colorClass: "text-amber-600 dark:text-amber-400 font-bold",
      };
    }
    return {
      label: `${priceImpactPct.toFixed(2)}%`,
      colorClass: "text-rose-600 dark:text-rose-400 font-black",
    };
  }, [priceImpactPct]);

  // Slippage validation warning
  const slippageWarning = useMemo(() => {
    const n = parseFloat(slippage);
    if (!Number.isFinite(n)) return null;
    if (n < 0.1) return "Slippage under 0.1% may cause transactions to revert.";
    if (n > 5) return "High slippage tolerance (> 5%) increases frontrunning risk.";
    return null;
  }, [slippage]);

  return (
    <div className="w-full max-w-[480px] mx-auto animate-meridian-rise">
      {/* Swap Card Frame */}
      <div className="relative rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow-card)] space-y-3.5 transition-all">
        {/* Card Header: Swap Title + Slippage & Settings Button */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-[var(--ink)]">Swap</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/20">
              Base Mainnet
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Auto-Refresh Indicator Ring */}
            {hasLiquidity && (
              <button
                type="button"
                onClick={() => executeQuoteFetch(false)}
                disabled={quoteLoading}
                aria-label="Refresh quote"
                className="h-8 w-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--brand)] hover:border-[var(--brand)] flex items-center justify-center transition-all cursor-pointer relative"
                title={`Auto-refreshing in ${countdown}s. Click to refresh now.`}
              >
                <RotateCcw size={13} className={quoteLoading ? "animate-spin text-[var(--brand)]" : ""} />
                <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-bold bg-[var(--surface)] text-[var(--ink-dim)] px-1 rounded-sm border border-[var(--border-subtle)]">
                  {countdown}s
                </span>
              </button>
            )}

            {/* Settings Button */}
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-label="Swap Settings"
              className={`h-8 px-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                showSettings
                  ? "bg-[var(--brand)] text-white border-[var(--brand)] shadow-xs"
                  : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
              }`}
            >
              <Settings2 size={14} />
              <span>{slippage}%</span>
            </button>
          </div>
        </div>

        {/* Settings Popover Drawer */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3.5 space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)] mb-1.5">
                  <span>Slippage Tolerance</span>
                  <span className="text-[var(--brand)] font-mono">{slippage}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {SLIPPAGE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={slippage === s}
                      onClick={() => setSlippage(s)}
                      className={`pop-pill flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        slippage === s
                          ? "bg-[var(--brand)] text-white shadow-xs"
                          : "bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Custom"
                      value={SLIPPAGE_PRESETS.includes(slippage) ? "" : slippage}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d.]/g, "");
                        setSlippage(val || "0.5");
                      }}
                      className="w-full py-1.5 px-2.5 text-center rounded-xl text-xs font-bold border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none focus:border-[var(--brand)]"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--ink-dim)] pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                {slippageWarning && (
                  <p className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>{slippageWarning}</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-[var(--ink)] mb-1.5">DEX Routing</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ROUTE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDex(opt.id)}
                      className={`pop-pill px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        dex === opt.id
                          ? "bg-[var(--brand)] text-white shadow-xs"
                          : "bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. SELL BOX */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 transition-all focus-within:border-[var(--brand)]/60 focus-within:ring-2 focus-within:ring-[var(--brand)]/10">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--ink-muted)] mb-2">
            <span>You Pay (Sell)</span>
            {wallet && !guestMode && (
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <span>Bal: {formatTokenBalanceDisplay(fromBalance, fromDecimals)}</span>
                <div className="inline-flex items-center gap-0.5 ml-1">
                  <button
                    type="button"
                    onClick={() => handleSetPct(0.25)}
                    className="pop-pill px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors cursor-pointer"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPct(0.5)}
                    className="pop-pill px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors cursor-pointer"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPct(-1)}
                    className="pop-pill px-1.5 py-0.5 rounded text-[10px] bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/20 hover:bg-[var(--brand)] hover:text-white transition-colors cursor-pointer font-black"
                  >
                    MAX
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl sm:text-3xl font-black font-mono tracking-tight text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none tabular-nums"
              aria-label="Sell Amount"
            />

            <button
              type="button"
              onClick={() => setPickerSide("from")}
              className="pop-pill shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] shadow-xs transition-all cursor-pointer"
            >
              <CounterAvatar counter={from} size={24} />
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-[var(--ink)]">{counterSymbol(from)}</span>
                {isVerifiedBaseToken(from) && <VerifiedBadge size={14} />}
              </div>
              <ChevronDown size={14} className="text-[var(--ink-dim)]" />
            </button>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-[var(--ink-dim)] font-mono">
            <span>{formatUsdSide(payUsd)}</span>
            {from.kind === "token" && from.symbol.endsWith("c") && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                Coinbase B20 Equity
              </span>
            )}
          </div>
        </div>

        {/* FLIP BUTTON */}
        <div className="relative flex justify-center -my-2.5 z-10">
          <motion.button
            type="button"
            onClick={flipPair}
            disabled={!to}
            animate={{ rotate: flipDegree }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            aria-label="Flip tokens"
            className="pop-pill h-9 w-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] shadow-md hover:bg-[var(--surface-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          >
            <ArrowDownUp size={16} />
          </motion.button>
        </div>

        {/* 2. BUY BOX */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--ink-muted)] mb-2">
            <span>You Receive (Buy Estimated)</span>
            {minReceive && hasLiquidity && !quoteLoading && to && (
              <span className="font-mono text-[11px] text-[var(--ink-dim)]">
                Min: {minReceive} {counterSymbol(to)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="w-full">
              {quoteLoading ? (
                <div className="h-8 w-32 bg-[var(--surface-3)] animate-pulse rounded-lg" />
              ) : (
                <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[var(--ink)] tabular-nums truncate">
                  {quoteOut ?? "0.0"}
                </p>
              )}
            </div>

            {loadingBuyMetadata ? (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xs animate-pulse">
                <div className="w-6 h-6 rounded-full bg-[var(--surface-3)]" />
                <div className="w-16 h-4 rounded bg-[var(--surface-3)]" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerSide("to")}
                className={`pop-pill shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl shadow-xs transition-all cursor-pointer ${
                  to
                    ? "bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)]"
                    : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                }`}
              >
                {to ? (
                  <>
                    <CounterAvatar counter={to} size={24} />
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm text-[var(--ink)]">{counterSymbol(to)}</span>
                      {isVerifiedBaseToken(to) && <VerifiedBadge size={14} />}
                    </div>
                  </>
                ) : (
                  <span className="font-bold text-sm">Select Token</span>
                )}
                <ChevronDown size={14} className={to ? "text-[var(--ink-dim)]" : "text-white/80"} />
              </button>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-[var(--ink-dim)] font-mono">
            <span>
              {quoteLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin text-[var(--brand)]" />
                  <span>Calculating price…</span>
                </span>
              ) : (
                formatUsdSide(receiveUsd)
              )}
            </span>
            {to && to.kind === "token" && to.symbol.endsWith("c") && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                Coinbase B20 Equity
              </span>
            )}
          </div>
        </div>

        {/* COLLAPSIBLE DETAILS ROW */}
        {hasLiquidity && quoteOut && (
          <div className="pop rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 space-y-2 text-xs">
            <button
              type="button"
              onClick={() => setShowDetails((d) => !d)}
              className="w-full flex items-center justify-between text-[var(--ink)] font-bold cursor-pointer"
            >
              <div
                className="flex items-center gap-1.5 hover:text-[var(--brand)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setInvertRate((v) => !v);
                }}
                title="Click to invert exchange rate"
              >
                <span className="font-mono">{exchangeRateString}</span>
                <span className="text-[10px] text-[var(--ink-dim)]">⇅</span>
              </div>

              <div className="flex items-center gap-1 text-[var(--ink-muted)]">
                {priceImpactBadge && (
                  <span className={`text-[11px] ${priceImpactBadge.colorClass} mr-1`}>
                    {priceImpactBadge.label} impact
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--ink-muted)]"
                >
                  <div className="flex items-center justify-between">
                    <span>Route</span>
                    <span className="font-bold text-[var(--ink)] font-mono">
                      {activeDex ? dexLabel(activeDex) : "Auto Best (Aggregated)"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Price Impact</span>
                    <span className={priceImpactBadge?.colorClass ?? "text-[var(--ink)]"}>
                      {priceImpactPct != null ? `${priceImpactPct.toFixed(2)}%` : "< 0.05%"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Minimum Received</span>
                    <span className="font-bold text-[var(--ink)] font-mono">
                      {minReceive ?? quoteOut} {to ? counterSymbol(to) : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Network Fee (Base Gas)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                      ~ $0.001 (Sub-cent)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Platform Fee</span>
                    <span className="font-bold text-[var(--ink)] font-mono">
                      {formatPlatformFeeLabel()} (0.50%)
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Error Message with Retry */}
        {quoteError && hasLiquidity === false && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
            <span className="font-semibold">{quoteError}</span>
            <button
              type="button"
              onClick={() => executeQuoteFetch(false)}
              className="inline-flex items-center gap-1 font-bold underline cursor-pointer hover:opacity-80"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Unverified Token Warning */}
        {((to && !isVerifiedBaseToken(to, { liquidityUsd: to.liquidityUsd }) && to.isUnverified) ||
          (from && !isVerifiedBaseToken(from, { liquidityUsd: from.liquidityUsd }) && from.isUnverified)) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span>Unverified token · Imported directly from Base on-chain contract</span>
          </div>
        )}

        {/* Regulatory / Eligibility Notice */}
        {((to?.kind === "token" && to.symbol.endsWith("c")) ||
          (from?.kind === "token" && from.symbol.endsWith("c"))) && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck size={14} className="text-blue-500 shrink-0" />
              <span className="truncate">{DEFAULT_STOCK_COMPLIANCE.neutralNotice}</span>
            </div>
            <a
              href={DEFAULT_STOCK_COMPLIANCE.issuerTermsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold shrink-0 inline-flex items-center gap-0.5 hover:opacity-80 text-blue-600 dark:text-blue-400"
            >
              <span>Terms</span>
              <ExternalLink size={10} />
            </a>
          </div>
        )}

        {/* Low Liquidity Stock Warning (Warn, Allow) */}
        {stockTradability && stockTradability.status === "low_liquidity" && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <span>Low on-chain liquidity — higher slippage expected. Trading is enabled.</span>
            </div>
            {stockTradability.suggestedAction?.url && (
              <a
                href={stockTradability.suggestedAction.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold underline shrink-0 hover:opacity-80"
              >
                <span>Pool</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Non-Tradable Stock State Details & Alternative Action */}
        {stockTradability && stockTradability.status === "no_pool" && (
          <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 text-[var(--ink-muted)]">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <div className="flex flex-col">
                <span>No DEX liquidity pool deployed on Base yet.</span>
                {stockTradability.suggestedAction?.url && (
                  <a
                    href={stockTradability.suggestedAction.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[var(--brand)] underline hover:opacity-80 inline-flex items-center gap-1"
                  >
                    <span>View token on BaseScan</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/lend";
                }
              }}
              className="pop-pill px-3 py-1.5 rounded-xl bg-[var(--brand)] text-white text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors shrink-0 cursor-pointer"
            >
              Lend &amp; Stake
            </button>
          </div>
        )}

        {stockTradability && stockTradability.status === "restricted" && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>Transfers restricted</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {stockTradability.reason}
            </p>
          </div>
        )}

        {/* Compliance Warning for Stock Buys */}
        {isStockBuyRestricted && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>{isStockSwapDisabled ? "Stock Swaps Disabled" : "Tokenized stock features are not available in your region"}</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {isStockSwapDisabled
                ? "Tokenized stock swaps are temporarily paused via safety kill switch."
                : "Exit-only mode is active: buying tokenized stocks is unavailable in your region, but you can sell existing tokenized stock holdings."}
            </p>
          </div>
        )}

        {/* PRIMARY ACTION BUTTON */}
        <button
          type="button"
          onClick={handleSwap}
          disabled={buttonState.disabled}
          className={`w-full py-3.5 px-5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 select-none cursor-pointer ${
            buttonState.disabled
              ? "bg-[var(--surface-3)] text-[var(--ink-dim)] border border-[var(--border-subtle)] cursor-not-allowed opacity-75"
              : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] shadow-md shadow-blue-500/25 active:scale-98"
          }`}
        >
          {isApproving ? (
            <>
              <Loader2 size={16} className="animate-spin text-white" />
              <span>Approving {counterSymbol(from)}…</span>
            </>
          ) : swapLoading ? (
            <>
              <Loader2 size={16} className="animate-spin text-white" />
              <span>Confirming on Base…</span>
            </>
          ) : txSuccessHash ? (
            <>
              <CheckCircle2 size={16} className="text-white" />
              <span>Swap Completed!</span>
            </>
          ) : (
            <span>{buttonState.label}</span>
          )}
        </button>

        {/* Transaction Success Banner with BaseScan link */}
        {txSuccessHash && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 size={15} />
              <span>Swap transaction confirmed on Base</span>
            </div>
            {wallet?.address && (
              <a
                href={`https://basescan.org/address/${wallet.address}#tokentxns`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline hover:opacity-80"
              >
                <span>BaseScan</span>
                <ExternalLink size={12} />
              </a>
            )}
          </motion.div>
        )}

        {/* Card Footer Note */}
        <p className="text-center text-[11px] text-[var(--ink-dim)]">
          {formatPlatformFeeLabel()} platform fee · 0x &amp; Aerodrome Smart Routing · Base Mainnet
        </p>
      </div>

      {/* Token Selector Modal / Bottom Sheet */}
      <TokenSelectorModal
        open={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        onSelect={(c) => {
          if (pickerSide === "from") {
            setFrom(c);
            setAmount(defaultFromAmount(c));
          } else {
            setTo(c);
          }
          setPickerSide(null);
        }}
        excludeAddress={
          pickerSide === "from"
            ? to?.kind === "token"
              ? to.address
              : "eth"
            : from.kind === "token"
              ? from.address
              : "eth"
        }
        title={pickerSide === "from" ? "Pay With (Sell)" : "Receive (Buy)"}
        holdings={holdings}
        walletAddress={wallet?.address}
      />

      {/* Stock Risk Acknowledgement Modal */}
      <StockRiskModal
        isOpen={compliance.modalOpen}
        onClose={compliance.closeModal}
        onAcknowledge={compliance.acknowledge}
        issuerTermsUrl={compliance.status.issuerTermsUrl}
      />
    </div>
  );
}
