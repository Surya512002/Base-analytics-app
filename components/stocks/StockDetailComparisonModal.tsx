"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Percent,
  Coins,
  Lock,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Layers,
  Info,
  ArrowDownToLine,
  ArrowUpRight,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import type { ConnectionType } from "@/lib/types/wallet";
import type { CoinbaseTokenizedStock } from "@/lib/stocks/coinbase-api";
import {
  getUnifiedStockLendingComparison,
  type StockLendingComparison,
  type StockLendingOption,
} from "@/lib/lending/unified-comparison";
import { buildUnifiedProtocolCalls } from "@/lib/lending/protocol-adapters";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { parseUnits, formatUnits, parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { simulateCallsBeforeExecution } from "@/lib/utils/tx-simulation";
import { formatTokenAmount } from "@/lib/launchpad/format";
import { USDC_BASE } from "@/lib/constants/contracts";
import { ERC20_ABI } from "@/lib/lending/constants";
import TokenLogo from "@/components/ui/TokenLogo";

export type ModalActionType =
  | "borrow"
  | "supply"
  | "repay"
  | "withdraw"
  | "strategy_deposit"
  | "strategy_withdraw";

interface StockDetailComparisonModalProps {
  stock: CoinbaseTokenizedStock;
  userAddress?: string | null;
  connType?: ConnectionType | null;
  onClose: () => void;
  onRequestConnect?: () => void;
  onSuccess?: () => void;
  initialOptionId?: string | null;
  initialAction?: ModalActionType | null;
}

export default function StockDetailComparisonModal({
  stock,
  userAddress,
  connType,
  onClose,
  onRequestConnect,
  onSuccess,
  initialOptionId = null,
  initialAction = null,
}: StockDetailComparisonModalProps) {
  const [comparison, setComparison] = useState<StockLendingComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"best_supply" | "best_borrow" | "liquidity" | "lowest_risk">("best_supply");
  const [selectedOption, setSelectedOption] = useState<StockLendingOption | null>(null);

  // Execution Modal State
  const [activeAction, setActiveAction] = useState<ModalActionType>(initialAction ?? "borrow");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<"idle" | "submitting" | "confirmed" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Balances
  const [stockBalance, setStockBalance] = useState<number>(0);
  const [stockBalanceRaw, setStockBalanceRaw] = useState<bigint>(BigInt(0));
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [usdcBalanceRaw, setUsdcBalanceRaw] = useState<bigint>(BigInt(0));
  const [loadingBalances, setLoadingBalances] = useState(false);

  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Load live wallet balances onchain (both Stock and USDC)
  useEffect(() => {
    if (!userAddress) {
      setStockBalance(0);
      setStockBalanceRaw(BigInt(0));
      setUsdcBalance(0);
      setUsdcBalanceRaw(BigInt(0));
      return;
    }

    let alive = true;
    setLoadingBalances(true);

    async function loadRealBalances() {
      try {
        const pub = createBasePublicClient();
        const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

        const [rawStock, rawUsdc] = await Promise.all([
          pub.readContract({
            address: stock.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [userAddress as `0x${string}`],
          }).catch(() => BigInt(0)),
          pub.readContract({
            address: USDC_BASE as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [userAddress as `0x${string}`],
          }).catch(() => BigInt(0)),
        ]);

        if (!alive) return;

        const humanStock = parseFloat(formatUnits(rawStock, stock.decimals));
        const humanUsdc = parseFloat(formatUnits(rawUsdc, 6));

        setStockBalance(Number.isFinite(humanStock) ? humanStock : 0);
        setStockBalanceRaw(rawStock);
        setUsdcBalance(Number.isFinite(humanUsdc) ? humanUsdc : 0);
        setUsdcBalanceRaw(rawUsdc);
      } catch {
        if (!alive) return;
        setStockBalance(0);
        setStockBalanceRaw(BigInt(0));
        setUsdcBalance(0);
        setUsdcBalanceRaw(BigInt(0));
      } finally {
        if (alive) setLoadingBalances(false);
      }
    }

    void loadRealBalances();
    return () => {
      alive = false;
    };
  }, [userAddress, stock.address, stock.decimals]);

  // Load comparison options
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getUnifiedStockLendingComparison(stock.symbol);
        if (alive) {
          setComparison(data);
          // Match initialOptionId or default to best borrow / first option
          const match = initialOptionId
            ? data.options.find((o) => o.id === initialOptionId || o.protocol === initialOptionId)
            : null;
          setSelectedOption(match ?? data.bestBorrowOption ?? data.options[0] ?? null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [stock.symbol, initialOptionId]);

  const sortedOptions = useMemo(() => {
    if (!comparison) return [];
    const list = [...comparison.options];
    if (sortBy === "best_supply") {
      list.sort((a, b) => b.supplyApy - a.supplyApy);
    } else if (sortBy === "best_borrow") {
      list.sort((a, b) => (a.borrowApr ?? 999) - (b.borrowApr ?? 999));
    } else if (sortBy === "liquidity") {
      list.sort((a, b) => b.availableLiquidityUsd - a.availableLiquidityUsd);
    } else if (sortBy === "lowest_risk") {
      list.sort((a, b) => a.riskScore - b.riskScore);
    }
    return list;
  }, [comparison, sortBy]);

  // Selected Option parameters
  const isStrategy = selectedOption?.type === "strategy";

  // Active token info for current action
  const isUsdAction = activeAction === "borrow" || activeAction === "repay";
  const activeAssetSymbol = isUsdAction ? "USDC" : stock.symbol;
  const activeAssetDecimals = isUsdAction ? 6 : stock.decimals;

  // Max Borrow capacity: Stock holdings × NAV × Max LTV
  const maxBorrowCapacityUsd = useMemo(() => {
    if (!selectedOption || selectedOption.maxLtv === null) return 0;
    const stockValUsd = stockBalance * (stock.nav || 1);
    const ltvRatio = (selectedOption.maxLtv || 75) / 100;
    const capacity = stockValUsd * ltvRatio;
    return Math.min(capacity, selectedOption.availableLiquidityUsd);
  }, [selectedOption, stockBalance, stock.nav]);

  // Handle clicking an action button on any protocol card
  const handleSelectOptionAndAction = (opt: StockLendingOption, action: ModalActionType) => {
    setSelectedOption(opt);
    setActiveAction(action);
    setAmount("");
    setErrorMessage(null);
    setTxStatus("idle");

    // Smooth scroll to execution drawer if below viewport
    setTimeout(() => {
      drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  // Quick percent calculation based on action type
  const handleQuickPercent = (pct: number) => {
    if (!userAddress) {
      onRequestConnect?.();
      return;
    }

    if (activeAction === "borrow") {
      if (maxBorrowCapacityUsd <= 0) {
        setAmount("0");
        return;
      }
      const val = (maxBorrowCapacityUsd * pct) / 100;
      setAmount(val.toFixed(2));
      return;
    }

    if (activeAction === "repay") {
      if (usdcBalance <= 0) {
        setAmount("0");
        return;
      }
      if (pct === 100 && usdcBalanceRaw > BigInt(0)) {
        setAmount(formatUnits(usdcBalanceRaw, 6));
      } else {
        const val = (usdcBalance * pct) / 100;
        setAmount(val.toFixed(2));
      }
      return;
    }

    // Supply or Strategy Deposit / Withdraw: uses stock balance
    if (stockBalance <= 0) {
      setAmount("0");
      return;
    }
    if (pct === 100 && stockBalanceRaw > BigInt(0)) {
      setAmount(formatUnits(stockBalanceRaw, stock.decimals));
    } else {
      const val = (stockBalance * pct) / 100;
      setAmount(val.toFixed(Math.min(4, stock.decimals)));
    }
  };

  // Execute protocol action
  const handleExecute = async () => {
    if (!userAddress || !connType) {
      onRequestConnect?.();
      return;
    }

    if (!selectedOption) return;

    const isExternalProtocol =
      selectedOption.protocol === "aave" ||
      selectedOption.protocol === "ipor" ||
      selectedOption.protocol === "aerodrome" ||
      selectedOption.protocol === "beefy";

    if (isExternalProtocol) {
      const targetUrl =
        selectedOption.protocol === "aave"
          ? "https://pro.aave.com/explore/borrow"
          : selectedOption.protocol === "ipor"
          ? "https://app.ipor.io/stocks"
          : selectedOption.protocol === "aerodrome"
          ? (selectedOption.sourceLink || "https://aerodrome.finance/pools")
          : (selectedOption.sourceLink || "https://app.beefy.com");

      if (typeof window !== "undefined") {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage("Please enter an amount greater than 0");
      return;
    }

    // Validation checks
    if (activeAction === "supply" || activeAction === "strategy_deposit") {
      if (numAmount > stockBalance) {
        setErrorMessage(
          `Insufficient ${stock.symbol} balance. You hold ${formatTokenAmount(
            stockBalance,
            stock.decimals
          )} ${stock.symbol}.`
        );
        return;
      }
    } else if (activeAction === "repay") {
      if (numAmount > usdcBalance) {
        setErrorMessage(
          `Insufficient USDC balance. You hold ${usdcBalance.toFixed(2)} USDC in your connected wallet.`
        );
        return;
      }
    } else if (activeAction === "borrow") {
      if (maxBorrowCapacityUsd > 0 && numAmount > maxBorrowCapacityUsd) {
        setErrorMessage(
          `Amount exceeds your maximum collateralized borrow capacity ($${maxBorrowCapacityUsd.toFixed(
            2
          )} USDC).`
        );
        return;
      }
      if (numAmount > selectedOption.availableLiquidityUsd) {
        setErrorMessage(
          `Insufficient protocol liquidity. Only $${(selectedOption.availableLiquidityUsd / 1e6).toFixed(
            1
          )}M USDC available.`
        );
        return;
      }
    }

    setTxStatus("submitting");
    setErrorMessage(null);

    try {
      const decimals = isUsdAction ? 6 : stock.decimals;
      const parsedAmount = parseUnits(amount, decimals);
      const pub = createBasePublicClient();

      const targetToken = isUsdAction
        ? selectedOption.loanAddress
        : selectedOption.stockAddress;

      let requiresApproval = false;
      if (activeAction === "supply" || activeAction === "repay" || activeAction === "strategy_deposit") {
        try {
          const allowance = await pub.readContract({
            address: targetToken,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [userAddress as `0x${string}`, selectedOption.contractAddress],
          });
          requiresApproval = (allowance as bigint) < parsedAmount;
        } catch {
          requiresApproval = true;
        }
      }

      const calls = buildUnifiedProtocolCalls({
        option: selectedOption,
        action: activeAction,
        amountRaw: parsedAmount,
        userAddress: userAddress as `0x${string}`,
        requiresApproval,
      });

      // Part 4: Pre-simulate every transaction first
      const sim = await simulateCallsBeforeExecution(pub, userAddress as `0x${string}`, calls);
      if (!sim.ok) {
        setErrorMessage(
          sim.restrictionFailed
            ? (sim.reason ?? "This token has transfer restrictions. You may not be eligible.")
            : (sim.reason ?? "Transaction simulation failed on-chain.")
        );
        setTxStatus("error");
        return;
      }

      const hash = await sendAppTransactions(connType, userAddress, calls, {
        atomicBatch: true,
      });

      setTxHash(hash);
      setTxStatus("confirmed");
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/reject|denied|cancel|4001/i.test(msg)) {
        setErrorMessage("Transaction was cancelled in wallet.");
      } else {
        setErrorMessage(msg.slice(0, 160));
      }
      setTxStatus("error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[var(--overlay)] backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-4xl rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-5 sm:p-7 shadow-2xl my-6 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <TokenLogo
              address={stock.address}
              symbol={stock.symbol}
              size={48}
              shape="rounded-xl"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight truncate">
                  {stock.symbol} Lending &amp; Borrowing
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  Live Onchain
                </span>
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5 truncate">
                {stock.name} · Underlying NAV:{" "}
                <strong className="text-[var(--ink)] font-bold">${stock.nav.toFixed(2)}</strong> ·
                Contract:{" "}
                <span className="font-mono text-[var(--ink-dim)]">
                  {stock.address.slice(0, 8)}...{stock.address.slice(-6)}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sorting Filters & Protocol Count Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-muted)] font-semibold">
              Comparing <strong>{comparison?.options.length ?? 0} verified Base protocols</strong>
            </span>
          </div>

          {sortedOptions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-[var(--ink-muted)] mr-1 shrink-0">Sort:</span>
              <button
                type="button"
                onClick={() => setSortBy("best_supply")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sortBy === "best_supply"
                    ? "bg-[var(--brand-soft)] text-[var(--brand-dark)] border border-[var(--brand)]/30 shadow-xs"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                Highest Supply APY
              </button>
              <button
                type="button"
                onClick={() => setSortBy("best_borrow")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sortBy === "best_borrow"
                    ? "bg-[var(--brand-soft)] text-[var(--brand-dark)] border border-[var(--brand)]/30 shadow-xs"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                Lowest Borrow Rate
              </button>
              <button
                type="button"
                onClick={() => setSortBy("liquidity")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sortBy === "liquidity"
                    ? "bg-[var(--brand-soft)] text-[var(--brand-dark)] border border-[var(--brand)]/30 shadow-xs"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                Deepest Liquidity
              </button>
              <button
                type="button"
                onClick={() => setSortBy("lowest_risk")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sortBy === "lowest_risk"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-xs"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                Lowest Risk
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Comparison Content */}
        <div className="overflow-y-auto py-3 space-y-3.5 flex-1 pr-1 scrollbar-thin">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 size={30} className="mx-auto text-[var(--brand)] animate-spin" />
              <p className="text-xs font-semibold text-[var(--ink-muted)]">
                Querying verified onchain contracts across Morpho Blue, Beefy Finance, and Aerodrome…
              </p>
            </div>
          ) : sortedOptions.length === 0 ? (
            <div className="py-12 px-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
                <ShieldAlert size={20} />
              </div>
              <h4 className="font-bold text-sm text-[var(--ink)]">
                No Verified Protocol Vaults on Base for {stock.symbol}
              </h4>
              <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto leading-relaxed">
                Beefy, Aerodrome, and Morpho curators have not yet deployed liquidity vaults for this asset. Only verified on-chain contracts with real liquidity are displayed.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <a
                  href="/swap"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand)] text-white text-xs font-bold hover:opacity-90 transition shadow-xs"
                >
                  <span>Trade {stock.symbol} on Swap</span>
                  <ArrowRight size={13} />
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {sortedOptions.map((opt) => {
                const isSelected = selectedOption?.id === opt.id;
                const optIsStrategy = opt.type === "strategy";

                return (
                  <div
                    key={opt.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isSelected
                        ? "border-[var(--brand)] bg-[var(--surface-2)] shadow-md ring-2 ring-[var(--brand)]/20"
                        : "border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--brand)]/60 hover:shadow-xs"
                    }`}
                  >
                    {/* Top Row: Protocol Identity, Badges & Strategy Tag */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-base text-[var(--ink)] leading-snug">
                          {opt.protocolName}
                        </h4>

                        {/* Strategy type pill */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] uppercase">
                          {opt.type === "strategy" ? "Auto-Carry Vault" : opt.typeLabel}
                        </span>

                        {opt.isBestSupply && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                            Top Supply APY
                          </span>
                        )}
                        {opt.isBestBorrow && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-dark)] border border-[var(--brand)]/25">
                            Lowest Borrow Rate
                          </span>
                        )}
                        {opt.isHighestLiquidity && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                            Deepest Liquidity
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-dark)] bg-[var(--brand-soft)] px-2.5 py-0.5 rounded-full border border-[var(--brand)]/20 self-start sm:self-auto">
                          <CheckCircle2 size={12} /> Active Selection
                        </span>
                      )}
                    </div>

                    {/* Middle Core Rates & Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                      {/* Supply APY */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                        <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">
                          Supply APY
                        </p>
                        <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                          {opt.supplyApy.toFixed(2)}%
                        </p>
                        <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">
                          {optIsStrategy ? "Auto-Compounding" : "Securities yield"}
                        </p>
                      </div>

                      {/* Borrow APR */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                        <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">
                          Borrow APR
                        </p>
                        <p className="font-mono text-xl font-black text-[var(--brand-dark)] dark:text-blue-400 mt-0.5 tabular-nums">
                          {opt.borrowApr !== null ? `${opt.borrowApr.toFixed(2)}%` : "N/A"}
                        </p>
                        <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">
                          {opt.borrowApr !== null ? "USDC variable loan" : "Pure Yield Vault"}
                        </p>
                      </div>

                      {/* Max LTV */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                        <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">
                          Max LTV
                        </p>
                        <p className="font-mono text-lg font-black text-[var(--ink)] mt-0.5 tabular-nums">
                          {opt.maxLtv !== null ? `${opt.maxLtv}%` : "Vault"}
                        </p>
                        <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">
                          {opt.liquidationThreshold ? `${opt.liquidationThreshold}% LLTV` : "Non-leveraged"}
                        </p>
                      </div>

                      {/* Available Liquidity */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                        <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">
                          Available Liq
                        </p>
                        <p className="font-mono text-lg font-black text-[var(--ink)] mt-0.5 tabular-nums">
                          ${(opt.availableLiquidityUsd / 1e6).toFixed(1)}M
                        </p>
                        <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">
                          {opt.riskLevel.toUpperCase()} Risk ({opt.riskScore}/10)
                        </p>
                      </div>
                    </div>

                    {/* Short Plain-Language Explainer */}
                    <div className="mt-2.5 text-xs text-[var(--ink-muted)] leading-relaxed">
                      <span>{opt.riskNotes[0]}</span>
                    </div>

                    {/* Action Button Strip */}
                    <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[var(--ink-dim)]">
                        Contract: <span className="font-mono">{opt.contractAddress.slice(0, 8)}...</span>
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {optIsStrategy ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectOptionAndAction(opt, "strategy_deposit")}
                              className="btn-primary py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-98"
                            >
                              <Sparkles size={12} />
                              <span>Deposit Strategy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOptionAndAction(opt, "strategy_withdraw")}
                              className="py-2 px-3 rounded-xl text-xs font-bold border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                            >
                              Withdraw
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectOptionAndAction(opt, "borrow")}
                              className="btn-primary py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-98"
                            >
                              <Lock size={12} />
                              <span>Borrow USDC</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOptionAndAction(opt, "supply")}
                              className="py-2 px-3 rounded-xl text-xs font-bold border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                            >
                              Supply Collateral
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOptionAndAction(opt, "repay")}
                              className="py-2 px-2.5 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                            >
                              Repay
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOptionAndAction(opt, "withdraw")}
                              className="py-2 px-2.5 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                            >
                              Withdraw
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Execution Drawer */}
          {selectedOption && (
            <div
              ref={drawerRef}
              className="rounded-2xl border-2 border-[var(--brand)] bg-[var(--surface)] p-5 mt-4 space-y-4 shadow-lg ring-1 ring-[var(--brand)]/15"
            >
              {/* Drawer Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--brand-dark)]">
                    Active Action:
                  </span>
                  <span className="text-sm font-black text-[var(--ink)]">
                    {selectedOption.protocolName}
                  </span>
                </div>

                {/* Action switch pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {isStrategy ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveAction("strategy_deposit")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          activeAction === "strategy_deposit"
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        Deposit Strategy
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAction("strategy_withdraw")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          activeAction === "strategy_withdraw"
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        Withdraw
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveAction("borrow")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          activeAction === "borrow"
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        Borrow USDC
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAction("supply")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          activeAction === "supply"
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        Supply Collateral
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAction("repay")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          activeAction === "repay"
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        Repay Debt
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAction("withdraw")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          activeAction === "withdraw"
                            ? "bg-[var(--brand)] text-white shadow-xs"
                            : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        Withdraw
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Amount Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink-muted)] flex-wrap gap-1">
                  <span>
                    Amount to{" "}
                    {activeAction === "borrow"
                      ? "Borrow (USDC)"
                      : activeAction === "repay"
                        ? "Repay (USDC)"
                        : activeAction === "supply"
                          ? `Supply (${stock.symbol})`
                          : activeAction === "strategy_deposit"
                            ? `Deposit (${stock.symbol})`
                            : "Withdraw"}
                  </span>

                  {/* Contextual Balance or Capacity */}
                  <div className="flex items-center gap-1.5">
                    {userAddress ? (
                      loadingBalances ? (
                        <Loader2 size={12} className="inline animate-spin opacity-60" />
                      ) : activeAction === "borrow" ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>Borrow Power:</span>
                          <button
                            type="button"
                            onClick={() => handleQuickPercent(100)}
                            className="font-mono font-bold text-[var(--brand-dark)] dark:text-blue-400 hover:underline"
                            title="Click to set maximum borrow capacity"
                          >
                            ${maxBorrowCapacityUsd.toFixed(2)} USDC
                          </button>
                        </div>
                      ) : activeAction === "repay" ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>USDC Balance:</span>
                          <button
                            type="button"
                            onClick={() => handleQuickPercent(100)}
                            className="font-mono font-bold text-[var(--ink)] hover:underline"
                            title="Click to set full USDC balance"
                          >
                            ${usdcBalance.toFixed(2)}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>Wallet Balance:</span>
                          <button
                            type="button"
                            onClick={() => handleQuickPercent(100)}
                            className={`font-mono font-bold hover:underline ${
                              stockBalance > 0 ? "text-[var(--ink)]" : "text-amber-600 dark:text-amber-400"
                            }`}
                            title="Click to set full token balance"
                          >
                            {formatTokenAmount(stockBalance, stock.decimals)} {stock.symbol}
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={onRequestConnect}
                        className="text-[var(--brand-dark)] dark:text-blue-400 hover:underline text-[11px]"
                      >
                        Connect Wallet
                      </button>
                    )}
                  </div>
                </div>

                {/* Input with embedded token pill */}
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    className="w-full pl-4 pr-24 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-lg font-black text-[var(--ink)] focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] transition-all font-mono"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 font-bold text-xs bg-[var(--surface)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--ink)] shadow-2xs">
                    <span>{activeAssetSymbol}</span>
                  </div>
                </div>

                {/* Quick percent buttons */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {[25, 50, 75, 100].map((pct) => {
                      const isZero =
                        activeAction === "borrow"
                          ? maxBorrowCapacityUsd <= 0
                          : activeAction === "repay"
                            ? usdcBalance <= 0
                            : stockBalance <= 0;

                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleQuickPercent(pct)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-colors ${
                            isZero
                              ? "opacity-60 bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)] hover:border-amber-500/40"
                              : "bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--ink)]"
                          }`}
                        >
                          {pct === 100 ? (isZero ? "MAX (0)" : "MAX") : `${pct}%`}
                        </button>
                      );
                    })}
                  </div>

                  {/* Informative edge-case notes */}
                  {userAddress && (
                    <div className="text-[11px] text-[var(--ink-muted)]">
                      {activeAction === "borrow" && maxBorrowCapacityUsd <= 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Supply {stock.symbol} first as collateral to borrow USDC
                        </span>
                      ) : activeAction === "supply" && stockBalance <= 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          0 {stock.symbol} available in wallet
                        </span>
                      ) : activeAction === "repay" && usdcBalance <= 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          0 USDC available in wallet
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Error or Success notification */}
              {errorMessage && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {txStatus === "confirmed" && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                    <span>Transaction successfully confirmed on Base mainnet!</span>
                  </div>
                  {txHash && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[11px] font-mono flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 hover:opacity-80"
                    >
                      Basescan <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}

              {/* Submit CTA */}
              {!userAddress ? (
                <button
                  type="button"
                  onClick={onRequestConnect}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Wallet size={16} />
                  <span>Connect Wallet to Execute</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={
                    txStatus === "submitting" ||
                    (!["aave", "ipor", "aerodrome", "beefy"].includes(selectedOption.protocol) && (
                      (activeAction === "borrow" && maxBorrowCapacityUsd <= 0) ||
                      ((activeAction === "supply" || activeAction === "strategy_deposit") &&
                        stockBalance <= 0) ||
                      (activeAction === "repay" && usdcBalance <= 0)
                    ))
                  }
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {txStatus === "submitting" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Signing &amp; Executing on Base…</span>
                    </>
                  ) : ["aave", "ipor", "aerodrome", "beefy"].includes(selectedOption.protocol) ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      {selectedOption.protocol === "aave" ? (
                        <>
                          <span>Open Aave Pro (Borrow against {stock.symbol})</span>
                          <ExternalLink size={14} />
                        </>
                      ) : selectedOption.protocol === "ipor" ? (
                        <>
                          <span>Open IPOR Stocks Vault ({selectedOption.supplyApy.toFixed(1)}% APY)</span>
                          <ExternalLink size={14} />
                        </>
                      ) : selectedOption.protocol === "beefy" ? (
                        <>
                          <span>Open Beefy Vault (Zap &amp; Stake)</span>
                          <ExternalLink size={14} />
                        </>
                      ) : (
                        <>
                          <span>Provide Liquidity on Aerodrome ({selectedOption.supplyApy.toFixed(1)}% APR)</span>
                          <ExternalLink size={14} />
                        </>
                      )}
                    </span>
                  ) : (
                    <>
                      <span>
                        Execute {activeAction.replace("_", " ").toUpperCase()} on{" "}
                        {selectedOption.protocolName}
                      </span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Disclaimers */}
        <div className="border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--ink-muted)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
          <p>
            Base Builder Attribution enabled. Tokenized US equities custody verified 1:1 on Base mainnet.
          </p>
          <span className="font-mono text-[10px] text-[var(--ink-dim)]">Base Chain ID: 8453</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
