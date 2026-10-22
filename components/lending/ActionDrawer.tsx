"use client";

import React, {
  useState,
  useEffect,
  useRef,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  RotateCcw,
  Wallet,
} from "lucide-react";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";
import type { ConnectionType } from "@/lib/types/wallet";
import { parseUnits, formatUnits } from "viem";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { buildUnifiedProtocolCalls } from "@/lib/lending/protocol-adapters";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { USDC_BASE_ADDRESS } from "@/lib/lending/constants";
import { simulateCallsBeforeExecution } from "@/lib/utils/tx-simulation";
import { getTokenizedStockBySymbol } from "@/lib/stocks/tokenized-stocks-registry";

export type DrawerActionTab = "supply" | "withdraw" | "borrow" | "repay";

export interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  option?: StockLendingOption | null;
  protocolName?: string;
  assetSymbol?: string;
  initialTab?: DrawerActionTab;
  userAddress?: string | null;
  connType?: ConnectionType | null;
  onRequestConnect?: () => void;
  onSuccess?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary: catches any runtime render crash in the drawer, logs to console,
// and shows a user-friendly recovery UI with Retry and Close buttons.
// ─────────────────────────────────────────────────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DrawerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ActionDrawer runtime error boundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 my-auto h-full min-h-[320px]">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-[var(--ink)]">Something went wrong</h3>
            <p className="text-xs text-[var(--ink-muted)] max-w-xs break-words">
              {this.state.error?.message || "An unexpected error occurred while displaying the action panel."}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] hover:text-[var(--brand-text)] border border-[var(--border-subtle)] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={this.props.onClose}
              className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white hover:opacity-90 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner Drawer Content Component
// ─────────────────────────────────────────────────────────────────────────────
function ActionDrawerContent({
  onClose,
  option,
  initialTab = "supply",
  userAddress,
  connType,
  onRequestConnect,
  onSuccess,
}: {
  onClose: () => void;
  option?: StockLendingOption | null;
  initialTab?: DrawerActionTab;
  userAddress?: string | null;
  connType?: ConnectionType | null;
  onRequestConnect?: () => void;
  onSuccess?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DrawerActionTab>(initialTab);
  const [amount, setAmount] = useState("");
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);

  // Balances
  const [stockBalance, setStockBalance] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Transaction States
  const [stepStatus, setStepStatus] = useState<
    "idle" | "approving" | "confirming" | "pending" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const isConnected = !!userAddress;

  // Sync tab with initialTab when opened
  useEffect(() => {
    setActiveTab(initialTab);
    setAmount("");
    setStepStatus("idle");
    setErrorMessage(null);
    setTxHash(null);
    setAcknowledgedRisk(false);
  }, [initialTab]);

  // Reset drawer body scroll to top and focus amount input on tab switch
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Fetch onchain balances for the stock token and USDC
  useEffect(() => {
    if (!userAddress || !option?.stockAddress) return;
    let alive = true;
    setLoadingBalances(true);

    async function loadBalances() {
      try {
        const pub = createBasePublicClient();
        const user = userAddress as `0x${string}`;

        const [stockBalRaw, usdcBalRaw] = await Promise.all([
          pub.readContract({
            address: option!.stockAddress,
            abi: [
              {
                name: "balanceOf",
                type: "function",
                stateMutability: "view",
                inputs: [{ name: "account", type: "address" }],
                outputs: [{ name: "", type: "uint256" }],
              },
            ],
            functionName: "balanceOf",
            args: [user],
          }) as Promise<bigint>,
          pub.readContract({
            address: USDC_BASE_ADDRESS,
            abi: [
              {
                name: "balanceOf",
                type: "function",
                stateMutability: "view",
                inputs: [{ name: "account", type: "address" }],
                outputs: [{ name: "", type: "uint256" }],
              },
            ],
            functionName: "balanceOf",
            args: [user],
          }) as Promise<bigint>,
        ]);

        if (alive) {
          setStockBalance(parseFloat(formatUnits(stockBalRaw, 8))); // 8 decimals for B20 stocks
          setUsdcBalance(parseFloat(formatUnits(usdcBalRaw, 6))); // 6 decimals for USDC
        }
      } catch {
        /* fallback to 0 */
      } finally {
        if (alive) setLoadingBalances(false);
      }
    }

    void loadBalances();
    return () => {
      alive = false;
    };
  }, [userAddress, option?.stockAddress]);

  // Safe Guard: Never show blank panel if option is missing or undefined
  if (!option || !option.stockSymbol) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md h-auto max-h-[90dvh] sm:h-[100dvh] sm:max-h-[100dvh] bg-[var(--surface-3)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between overflow-hidden rounded-t-3xl sm:rounded-none"
      >
        <div className="p-5 pb-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <span className="font-mono font-bold text-sm text-[var(--ink)]">Market Action</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close action drawer"
            className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--ink)]">Protocol Details Unavailable</h3>
            <p className="text-xs text-[var(--ink-muted)] max-w-xs leading-relaxed">
              Could not retrieve the protocol market details for this option. Please select an available market from the table.
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--surface-3)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-xl bg-[var(--brand)] text-white font-bold text-xs hover:opacity-90 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Active token for the selected action
  const stockEntry = option?.stockSymbol ? getTokenizedStockBySymbol(option.stockSymbol) : undefined;
  const activeTokenSymbol =
    activeTab === "borrow" || activeTab === "repay" ? "USDC" : option.stockSymbol;
  const currentAvailableBalance =
    activeTab === "borrow" || activeTab === "repay" ? usdcBalance : stockBalance;

  const parsedAmount = parseFloat(amount) || 0;
  const isInsufficientBalance =
    (activeTab === "supply" || activeTab === "repay") && parsedAmount > currentAvailableBalance;

  // Live financial calculations for preview
  const isFixedTerm = option.type === "fixed" && option.fixedTermDays;
  const termEndDate = new Date();
  if (isFixedTerm) termEndDate.setDate(termEndDate.getDate() + (option.fixedTermDays || 60));

  // Projected Supply Earnings
  const supplyApyVal = option.supplyApy ?? 0;
  const dailySupplyEarnings = (parsedAmount * (supplyApyVal / 100)) / 365;
  const monthlySupplyEarnings = dailySupplyEarnings * 30;
  const yearlySupplyEarnings = parsedAmount * (supplyApyVal / 100);

  // Projected Borrow Metrics
  const estimatedLtv = option.maxLtv ? option.maxLtv - 5 : 70;
  const monthlyBorrowCost = (parsedAmount * ((option.borrowApr ?? 3.5) / 100)) / 12;

  // High risk or high LTV check
  const isHighRisk = option.riskLevel === "high";
  const needsRiskAck = isHighRisk && !acknowledgedRisk;

  // Multi-state button logic
  const handleActionClick = async () => {
    if (!isConnected) {
      onRequestConnect?.();
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) return;
    if (isInsufficientBalance) return;
    if (needsRiskAck) return;

    setStepStatus("approving");
    setErrorMessage(null);

    try {
      const pub = createBasePublicClient();
      const user = userAddress as `0x${string}`;
      const dec = activeTab === "borrow" || activeTab === "repay" ? 6 : 8;
      const amountRaw = parseUnits(amount, dec);

      const calls = buildUnifiedProtocolCalls({
        option,
        action:
          activeTab === "supply"
            ? option.type === "strategy"
              ? "strategy_deposit"
              : "supply"
            : activeTab === "withdraw"
              ? option.type === "strategy"
                ? "strategy_withdraw"
                : "withdraw"
              : activeTab === "borrow"
                ? "borrow"
                : "repay",
        amountRaw,
        userAddress: user,
        requiresApproval: true,
      });

      // Part 4: Pre-simulate every transaction first before prompting wallet
      const sim = await simulateCallsBeforeExecution(pub, user, calls);
      if (!sim.ok) {
        setStepStatus("error");
        setErrorMessage(
          sim.restrictionFailed
            ? (sim.reason ?? "This token has transfer restrictions. You may not be eligible.")
            : (sim.reason ?? "Transaction simulation failed on-chain.")
        );
        return;
      }

      setStepStatus("confirming");
      const hash = await sendAppTransactions(connType ?? "injected", user, calls);
      setTxHash(hash);
      setStepStatus("success");
      onSuccess?.();
    } catch (e) {
      setStepStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const setPercentAmount = (pct: number) => {
    if (currentAvailableBalance <= 0) return;
    const calculated = (currentAvailableBalance * pct) / 100;
    setAmount(calculated.toFixed(activeTokenSymbol === "USDC" ? 2 : 4));
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md h-auto max-h-[90dvh] sm:h-[100dvh] sm:max-h-[100dvh] bg-[var(--surface-3)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] shadow-2xl flex flex-col min-h-0 overflow-hidden rounded-t-3xl sm:rounded-none"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER (Pinned at Top)
          ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-5 pb-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span id="action-drawer-title" className="font-mono font-black text-sm text-[var(--ink)]">
                {option.stockSymbol}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">· {option.protocolName}</span>
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">{option.typeLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close action drawer"
            className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Tabs: Supply / Deposit | Withdraw | Borrow | Repay */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          {(["supply", "withdraw", "borrow", "repay"] as DrawerActionTab[]).map((tab) => {
            const isSelected = activeTab === tab;
            const disabled =
              (tab === "borrow" || tab === "repay") &&
              (option.borrowApr === null || option.borrowApr <= 0);

            const tabLabel =
              tab === "supply" && option.type === "strategy" ? "Deposit" : tab;

            return (
              <button
                key={tab}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setActiveTab(tab);
                  setAmount("");
                }}
                className={`py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                  isSelected
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-35 disabled:cursor-not-allowed"
                }`}
              >
                {tabLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. BODY (Scrollable flex-1 min-h-0)
          ───────────────────────────────────────────────────────────── */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Wallet Disconnected Callout State */}
        {!isConnected && (
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--brand-soft)] space-y-2.5">
            <div className="flex items-center gap-2 text-[var(--brand-text)] font-bold text-xs">
              <Wallet size={15} />
              <span>Wallet Not Connected</span>
            </div>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Connect your Coinbase Wallet, Smart Wallet, or browser wallet to interact with {option.protocolName} and view your {activeTokenSymbol} balance.
            </p>
            <button
              type="button"
              onClick={onRequestConnect}
              className="w-full py-2.5 px-3 rounded-xl bg-[var(--brand)] text-white hover:opacity-90 font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wallet size={14} />
              <span>Connect Wallet</span>
            </button>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-[var(--ink)]">Amount</label>
            <span className="text-[var(--ink-muted)]">
              Available:{" "}
              {loadingBalances ? (
                <span className="inline-block w-16 h-3 rounded bg-[var(--border-subtle)] animate-pulse align-middle" />
              ) : (
                <strong className="text-[var(--ink)] font-mono">
                  {currentAvailableBalance.toFixed(4)} {activeTokenSymbol}
                </strong>
              )}
            </span>
          </div>

          <div className="relative">
            <input
              ref={amountInputRef}
              type="number"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-3.5 pr-20 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] font-mono text-lg font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--brand-text)]"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs text-[var(--ink)]">
                {activeTokenSymbol}
              </span>
            </div>
          </div>

          {/* Quick 25 / 50 / 75 / MAX percentage buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!isConnected || currentAvailableBalance <= 0}
                onClick={() => setPercentAmount(pct)}
                className="py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-mono font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand-text)] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Live Transaction Preview */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2.5 text-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
            Transaction Preview
          </span>

          {activeTab === "supply" && (
            <div className="space-y-1.5 text-[var(--ink-muted)]">
              <div className="flex justify-between">
                <span>{option.type === "strategy" ? "Strategy APY:" : "Supply APY:"}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {supplyApyVal.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Est. Monthly Return:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  +${monthlySupplyEarnings.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between">
                <span>Est. Yearly Return:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  +${yearlySupplyEarnings.toFixed(2)} USD
                </span>
              </div>
            </div>
          )}

          {activeTab === "borrow" && (
            <div className="space-y-1.5 text-[var(--ink-muted)]">
              <div className="flex justify-between">
                <span>Borrow APR:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {option.borrowApr != null ? `${option.borrowApr.toFixed(2)}%` : "3.20%"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Current Max LTV:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {option.maxLtv != null ? `${option.maxLtv}%` : "75%"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Est. Monthly Interest:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  ~${monthlyBorrowCost.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span>Liquidation Buffer:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Safe (&gt;1.5 Health)
                </span>
              </div>
            </div>
          )}

          {activeTab === "withdraw" && (
            <div className="space-y-1.5 text-[var(--ink-muted)]">
              <div className="flex justify-between">
                <span>Asset to Withdraw:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {activeTokenSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Settlement:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Instant · Base Mainnet
                </span>
              </div>
            </div>
          )}

          {activeTab === "repay" && (
            <div className="space-y-1.5 text-[var(--ink-muted)]">
              <div className="flex justify-between">
                <span>Debt Asset:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span>Collateral Status:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Unlocked upon settlement
                </span>
              </div>
            </div>
          )}

          {isFixedTerm && (
            <div className="pt-2 border-t border-[var(--border-subtle)]/60 text-[11px] space-y-1">
              <div className="flex justify-between text-[var(--ink-muted)]">
                <span>Fixed Maturity:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {termEndDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="text-[10px] text-[var(--ink-dim)]">
                Morpho Midnight guarantees this fixed rate until term maturity.
              </p>
            </div>
          )}
        </div>

        {/* Token Restriction & Eligibility Notice (Part 4) */}
        {stockEntry?.restrictions && (stockEntry.restrictions.transferRestricted || stockEntry.restrictions.allowlistOnly) && (
          <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Token Transfer & Eligibility Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-95">
              {stockEntry.restrictions.legalNote ?? "This tokenized stock may enforce issuer allowlists, transfer restrictions, or geographic limits."}
            </p>
            <p className="text-[10px] text-[var(--ink-muted)] italic">
              Notice: Eligibility and disclosure terms are subject to compliance and legal review. No legal or tax advice provided.
            </p>
          </div>
        )}

        {/* Risk Warning & Gating Checkbox (if High-Risk) */}
        {isHighRisk && (
          <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Isolated Vault Risk Disclosure</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-95">
              This strategy involves concentrated stock carry yield with dynamic liquidation parameters.
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgedRisk}
                onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--brand)] accent-[var(--brand)]"
              />
              <span className="font-bold text-xs text-[var(--ink)]">
                I understand protocol liquidation terms
              </span>
            </label>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span>Transaction failed</span>
              <button
                type="button"
                onClick={handleActionClick}
                className="underline flex items-center gap-1 hover:text-red-700 cursor-pointer"
              >
                <RotateCcw size={11} /> Retry
              </button>
            </div>
            <p className="text-[11px] leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Success Receipt */}
        {stepStatus === "success" && txHash && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span>Transaction Confirmed!</span>
            </div>
            <p className="text-[11px]">Your onchain transaction succeeded on Base mainnet.</p>
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-text)] hover:underline pt-0.5"
            >
              <span>View on BaseScan</span>
              <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. FOOTER (Pinned at Bottom with Safe-Area Padding)
          ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--surface)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {!isConnected ? (
          <button
            type="button"
            onClick={onRequestConnect}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[var(--brand)] text-white hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Wallet size={16} />
            <span>Connect Wallet</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={
              stepStatus === "approving" ||
              stepStatus === "confirming" ||
              !parsedAmount ||
              isInsufficientBalance ||
              needsRiskAck
            }
            onClick={handleActionClick}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              stepStatus === "approving" || stepStatus === "confirming"
                ? "bg-[var(--brand)] text-white opacity-80 cursor-wait"
                : isInsufficientBalance
                  ? "bg-[var(--surface-2)] text-red-500 border border-red-500/30 cursor-not-allowed"
                  : needsRiskAck
                    ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed"
                    : !parsedAmount
                      ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-60"
                      : "bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98]"
            }`}
          >
            {stepStatus === "approving" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Approving {activeTokenSymbol}…</span>
              </>
            ) : stepStatus === "confirming" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Confirming in Wallet…</span>
              </>
            ) : isInsufficientBalance ? (
              <span>Insufficient {activeTokenSymbol} Balance</span>
            ) : !parsedAmount ? (
              <span>Enter Amount</span>
            ) : needsRiskAck ? (
              <span>Acknowledge Risk to Continue</span>
            ) : (
              <span>
                {activeTab === "supply"
                  ? option.type === "strategy"
                    ? "Deposit to Strategy"
                    : `Supply ${activeTokenSymbol}`
                  : activeTab === "borrow"
                    ? `Borrow ${activeTokenSymbol}`
                    : activeTab === "withdraw"
                      ? option.type === "strategy"
                        ? "Withdraw from Strategy"
                        : `Withdraw ${activeTokenSymbol}`
                      : `Repay ${activeTokenSymbol}`}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Export: ActionDrawer mounted via Portal into document.body
// ─────────────────────────────────────────────────────────────────────────────
export default function ActionDrawer(props: ActionDrawerProps) {
  const { isOpen, onClose } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock page scroll on open without layout jump, and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <DrawerErrorBoundary onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-stretch justify-end bg-[var(--overlay)] backdrop-blur-xs transition-opacity"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-drawer-title"
      >
        <ActionDrawerContent {...props} />
      </div>
    </DrawerErrorBoundary>,
    document.body
  );
}
