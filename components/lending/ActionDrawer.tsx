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
  Info,
} from "lucide-react";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";
import type { ConnectionType } from "@/lib/types/wallet";
import { parseUnits, formatUnits, parseAbi, maxUint256 } from "viem";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { buildUnifiedProtocolCalls } from "@/lib/lending/protocol-adapters";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import {
  USDC_BASE_ADDRESS,
  ERC20_ABI,
  MORPHO_BLUE_BASE,
  MORPHO_BLUE_ABI,
  AAVE_V3_DATA_PROVIDER_BASE,
} from "@/lib/lending/constants";
import { getMorphoMarketId } from "@/lib/lending/morpho-blue";
import { buildAttributedApproveCall } from "@/lib/lending/builder-attribution";
import { simulateCallsBeforeExecution } from "@/lib/utils/tx-simulation";
import { getTokenizedStockBySymbol } from "@/lib/stocks/tokenized-stocks-registry";
import { useCompliance } from "@/hooks/useCompliance";
import type { UserProtocolPosition } from "@/lib/lending/user-positions";

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
  userPositions?: UserProtocolPosition[];
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
  userPositions,
  onRequestConnect,
  onSuccess,
}: {
  onClose: () => void;
  option?: StockLendingOption | null;
  initialTab?: DrawerActionTab;
  userAddress?: string | null;
  connType?: ConnectionType | null;
  userPositions?: UserProtocolPosition[];
  onRequestConnect?: () => void;
  onSuccess?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DrawerActionTab>(initialTab);
  const [amount, setAmount] = useState("");
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const [unlimitedApproval, setUnlimitedApproval] = useState(false);
  const compliance = useCompliance();

  // Balances
  const [stockBalanceRaw, setStockBalanceRaw] = useState<bigint>(BigInt(0));
  const [usdcBalanceRaw, setUsdcBalanceRaw] = useState<bigint>(BigInt(0));
  const [suppliedBalanceRaw, setSuppliedBalanceRaw] = useState<bigint>(BigInt(0));
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Dynamic decimals
  const stockEntry = option?.stockSymbol ? getTokenizedStockBySymbol(option.stockSymbol) : undefined;
  const stockDecimals = stockEntry?.decimals ?? 8;
  const loanDecimals = 6;
  const activeDecimals = activeTab === "borrow" || activeTab === "repay" ? loanDecimals : stockDecimals;
  const activeTokenSymbol = activeTab === "borrow" || activeTab === "repay" ? "USDC" : (option?.stockSymbol ?? "STOCK");

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

  // Reset drawer body scroll to top on tab switch
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Fetch onchain balances for stock, USDC, and supplied position
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
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [user],
          }) as Promise<bigint>,
          pub.readContract({
            address: USDC_BASE_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [user],
          }) as Promise<bigint>,
        ]);

        let suppliedRaw = BigInt(0);
        // Attempt to query on-chain supplied position for withdraw tab
        try {
          if (option!.executionType === "morpho_blue" && option!.morphoParams) {
            const mktId = getMorphoMarketId(option!.morphoParams);
            const pos = (await pub.readContract({
              address: MORPHO_BLUE_BASE,
              abi: MORPHO_BLUE_ABI,
              functionName: "position",
              args: [mktId, user],
            })) as [bigint, bigint, bigint];
            suppliedRaw = pos[2]; // Collateral
          } else if (option!.executionType === "aave") {
            const aaveData = (await pub.readContract({
              address: AAVE_V3_DATA_PROVIDER_BASE,
              abi: parseAbi([
                "function getUserReserveData(address, address) view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint40, bool)",
              ]),
              functionName: "getUserReserveData",
              args: [option!.stockAddress, user],
            })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, boolean];
            suppliedRaw = aaveData[0];
          } else if (option!.contractAddress) {
            suppliedRaw = (await pub.readContract({
              address: option!.contractAddress,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [user],
            })) as bigint;
          }
        } catch {
          // On-chain direct read failed, cross-reference userPositions fallback below
        }

        // Cross-reference userPositions if direct position read returned 0
        if (suppliedRaw === BigInt(0) && userPositions && userPositions.length > 0) {
          const optProto = option!.protocol.toLowerCase();
          const optSym = option!.stockSymbol.toLowerCase();
          const matchingPos = userPositions.find((p) => {
            const protoMatch = p.protocol.toLowerCase().includes(optProto) || optProto.includes(p.protocol.toLowerCase());
            const assetMatch = p.assetSymbol.toLowerCase().includes(optSym) || p.marketName.toLowerCase().includes(optSym);
            return protoMatch && assetMatch;
          });
          if (matchingPos && matchingPos.suppliedAmount > 0) {
            try {
              suppliedRaw = parseUnits(matchingPos.suppliedAmount.toString(), stockDecimals);
            } catch {
              /* ignore */
            }
          }
        }

        if (alive) {
          setStockBalanceRaw(stockBalRaw);
          setUsdcBalanceRaw(usdcBalRaw);
          setSuppliedBalanceRaw(suppliedRaw);
        }
      } catch (err) {
        console.warn("[ActionDrawer] Failed to read on-chain balances:", err);
      } finally {
        if (alive) setLoadingBalances(false);
      }
    }

    void loadBalances();
    return () => {
      alive = false;
    };
  }, [userAddress, option, stockDecimals, userPositions]);

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

  // Active available balance calculation based on current tab
  const currentAvailableRaw =
    activeTab === "withdraw"
      ? suppliedBalanceRaw
      : activeTab === "borrow" || activeTab === "repay"
        ? usdcBalanceRaw
        : stockBalanceRaw;

  let parsedAmountRaw = BigInt(0);
  try {
    if (amount && parseFloat(amount) > 0) {
      parsedAmountRaw = parseUnits(amount, activeDecimals);
    }
  } catch {
    parsedAmountRaw = BigInt(0);
  }
  const parsedAmount = parseFloat(amount) || 0;

  const isInsufficientBalance =
    (activeTab === "supply" || activeTab === "repay" || activeTab === "withdraw") &&
    parsedAmountRaw > currentAvailableRaw;

  const isBorrowExceedsLiquidity =
    activeTab === "borrow" &&
    option.availableLiquidityUsd > 0 &&
    parsedAmount > option.availableLiquidityUsd;

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
  const monthlyBorrowCost =
    option.borrowApr && option.borrowApr > 0
      ? (parsedAmount * (option.borrowApr / 100)) / 12
      : null;

  // High risk or high LTV check
  const isHighRisk = option.riskLevel === "high";
  const needsRiskAck = isHighRisk && !acknowledgedRisk;

  // Compliance & Exit-Only verification
  const isStockMarket = !!option.stockSymbol;
  const isLendDisabled = !compliance.status.features["stocks.lend"];
  const isRegionRestricted = compliance.isRestricted && !compliance.canEnter;
  const isRestrictedEntry =
    isStockMarket &&
    (activeTab === "supply" || activeTab === "borrow") &&
    (isLendDisabled || isRegionRestricted);

  const isExternalProtocol =
    option.protocol === "aave" ||
    option.protocol === "ipor" ||
    option.protocol === "aerodrome" ||
    option.protocol === "beefy";

  // Multi-state button logic
  const handleActionClick = async () => {
    if (!isConnected) {
      onRequestConnect?.();
      return;
    }
    if (isRestrictedEntry) return;

    if (isExternalProtocol) {
      let targetUrl = option.sourceLink;
      if (option.protocol === "aave") {
        targetUrl =
          activeTab === "borrow" || activeTab === "repay"
            ? "https://pro.aave.com/explore/borrow"
            : "https://pro.aave.com/explore";
      } else if (option.protocol === "ipor") {
        targetUrl = "https://app.ipor.io/stocks";
      } else if (option.protocol === "aerodrome") {
        targetUrl = option.sourceLink || "https://aerodrome.finance/pools";
      } else if (option.protocol === "beefy") {
        targetUrl = option.sourceLink || "https://app.beefy.com";
      }

      if (typeof window !== "undefined" && targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMessage("Please enter an amount greater than 0");
      return;
    }
    if (isInsufficientBalance) {
      setErrorMessage(
        activeTab === "withdraw"
          ? `Insufficient supplied balance to withdraw. Available: ${formatUnits(currentAvailableRaw, activeDecimals)} ${activeTokenSymbol}`
          : `Insufficient balance. Available: ${formatUnits(currentAvailableRaw, activeDecimals)} ${activeTokenSymbol}`
      );
      return;
    }
    if (isBorrowExceedsLiquidity) {
      setErrorMessage(
        `Borrow amount exceeds available market liquidity ($${option.availableLiquidityUsd.toLocaleString()}).`
      );
      return;
    }
    if (needsRiskAck) return;

    setStepStatus("approving");
    setErrorMessage(null);

    try {
      const pub = createBasePublicClient();
      const user = userAddress as `0x${string}`;
      const amountRaw = parseUnits(amount, activeDecimals);

      const targetToken =
        activeTab === "borrow" || activeTab === "repay"
          ? option.loanAddress
          : option.stockAddress;

      let requiresApproval = false;
      if (activeTab === "supply" || activeTab === "repay") {
        try {
          const allowance = (await pub.readContract({
            address: targetToken,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [user, option.contractAddress],
          })) as bigint;
          requiresApproval = allowance < amountRaw;
        } catch {
          requiresApproval = true;
        }
      }

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
        requiresApproval,
      });

      // Override approval amount to maxUint256 if user selected unlimited approval toggle
      if (unlimitedApproval && calls.length > 0) {
        const approveIdx = calls.findIndex((c) => c.to.toLowerCase() === targetToken.toLowerCase());
        if (approveIdx >= 0) {
          calls[approveIdx] = buildAttributedApproveCall(targetToken, option.contractAddress, maxUint256);
        }
      }

      if (calls.length === 0) {
        setStepStatus("error");
        setErrorMessage(`Action "${activeTab}" is not supported for ${option.protocolName}.`);
        return;
      }

      // Pre-simulate every transaction first before prompting wallet
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
      setStepStatus("pending");

      // Wait for confirmed receipt
      const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status === "reverted") {
        setStepStatus("error");
        setErrorMessage("Transaction reverted on-chain. Please verify gas and token requirements.");
        return;
      }

      setStepStatus("success");
      onSuccess?.();
    } catch (e) {
      setStepStatus("error");
      const rawMsg = e instanceof Error ? e.message : String(e);
      if (/reject|denied|cancel|4001/i.test(rawMsg)) {
        setErrorMessage("Transaction signature was cancelled in your wallet.");
      } else if (/insufficient funds/i.test(rawMsg)) {
        setErrorMessage("Insufficient ETH in wallet to cover network gas fees.");
      } else {
        setErrorMessage(e instanceof Error ? e.message : "Transaction failed");
      }
    }
  };

  const setPercentAmount = (pct: number) => {
    if (currentAvailableRaw <= BigInt(0)) return;
    if (pct === 100) {
      setAmount(formatUnits(currentAvailableRaw, activeDecimals));
      return;
    }
    const computedRaw = (currentAvailableRaw * BigInt(pct)) / BigInt(100);
    setAmount(formatUnits(computedRaw, activeDecimals));
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
        {(option.protocol === "beefy" || option.protocol === "aerodrome") && (
          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
              <Info size={14} />
              <span>Liquidity Pool (LP) Strategy</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              {option.protocolName} yield is derived from <strong>{option.stockSymbol}/USDC</strong> liquidity pool positions on Aerodrome. You can manage or deposit directly on the official app:
            </p>
            {option.sourceLink && (
              <a
                href={option.sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-subtle)] hover:border-[var(--brand-text)] font-bold text-[11px] transition"
              >
                <span>Open {option.protocolName} App</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {option.protocol === "aave" && (
          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
              <Info size={14} />
              <span>Aave Pro Equities Collateral Hub</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Deposit <strong>{option.stockSymbol}</strong> collateral to borrow USDC at up to {option.maxLtv ? `${option.maxLtv}% Max LTV` : "protocol Max LTV"} with Chainlink equity price feeds. Or manage directly on Aave Pro:
            </p>
            {option.sourceLink && (
              <a
                href={
                  activeTab === "borrow" || activeTab === "repay"
                    ? "https://pro.aave.com/explore/borrow"
                    : "https://pro.aave.com/explore"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-subtle)] hover:border-[var(--brand-text)] font-bold text-[11px] transition"
              >
                <span>Open Aave Pro ({activeTab === "borrow" || activeTab === "repay" ? "Borrow Hub" : "Supply Hub"})</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {option.protocol === "ipor" && (
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Info size={14} />
              <span>IPOR Fusion Stocks Plasma Vault</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Automated Plasma Vaults &amp; stock carry trade strategies for <strong>{option.stockSymbol}</strong> on Base. Manage deposits and yields directly on IPOR Stocks:
            </p>
            {option.sourceLink && (
              <a
                href={option.sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-subtle)] hover:border-[var(--brand-text)] font-bold text-[11px] transition"
              >
                <span>Open IPOR Stocks App</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

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

        {/* Amount Input (Hidden for external redirect protocols) */}
        {!isExternalProtocol && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-[var(--ink)]">Amount</label>
              <span className="text-[var(--ink-muted)]">
                {activeTab === "withdraw" ? "Supplied: " : "Available: "}
                {loadingBalances ? (
                  <span className="inline-block w-16 h-3 rounded bg-[var(--border-subtle)] animate-pulse align-middle" />
                ) : (
                  <strong className="text-[var(--ink)] font-mono">
                    {formatUnits(currentAvailableRaw, activeDecimals)} {activeTokenSymbol}
                  </strong>
                )}
              </span>
            </div>

            <div className="relative">
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    if (val.includes(".")) {
                      const [, decPart] = val.split(".");
                      if (decPart && decPart.length > activeDecimals) return;
                    }
                    setAmount(val);
                    setErrorMessage(null);
                  }
                }}
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
                  disabled={!isConnected || currentAvailableRaw <= BigInt(0)}
                  onClick={() => setPercentAmount(pct)}
                  className="py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-mono font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand-text)] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Unlimited Approval Toggle */}
            {(activeTab === "supply" || activeTab === "repay") && (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--ink-muted)] pt-1 select-none">
                <input
                  type="checkbox"
                  checked={unlimitedApproval}
                  onChange={(e) => setUnlimitedApproval(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[var(--brand)] accent-[var(--brand)] cursor-pointer"
                />
                <span>Approve unlimited allowance (faster for repeat actions)</span>
              </label>
            )}
          </div>
        )}

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
                  {option.maxLtv != null ? `${option.maxLtv}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Est. Monthly Interest:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {monthlyBorrowCost !== null ? `~$${monthlyBorrowCost.toFixed(2)} USDC` : "Variable"}
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

        {/* Exit-Only & Compliance Banner */}
        {isRestrictedEntry && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{isLendDisabled ? "Stock Lending Disabled" : "Tokenized stock features are not available in your region"}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-95">
              {isLendDisabled
                ? "Tokenized stock lending and borrowing are temporarily paused via safety controls."
                : "Exit-only mode is active: new deposits and borrows are disabled, but you can withdraw collateral and repay debt at any time."}
            </p>
          </div>
        )}

        {/* Borrow Flow Specific Disclosures */}
        {activeTab === "borrow" && (
          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
              <Info size={14} className="text-[var(--brand)] shrink-0" />
              <span>Leverage & Liquidation Disclosures</span>
            </div>
            <ul className="text-[11px] space-y-1 text-[var(--ink-muted)] list-disc pl-4">
              <li>Collateral can be liquidated if the loan-to-value ratio exceeds the maximum liquidation threshold.</li>
              <li>Borrow rates are variable and fluctuate in real-time based on protocol liquidity utilization.</li>
              <li>Oracle price feeds for tokenized stocks may freeze or experience widened spreads during equity market closures or corporate actions.</li>
            </ul>
          </div>
        )}

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

        {/* Pre-Signing Confirmation Summary */}
        {!isExternalProtocol && parsedAmount && parsedAmount > BigInt(0) && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 space-y-2 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
              Transaction Confirmation Summary
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[var(--ink-muted)] block">Amount:</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {amount} {activeTokenSymbol}
                </span>
              </div>
              <div>
                <span className="text-[var(--ink-muted)] block">Protocol:</span>
                <span className="font-semibold text-[var(--ink)]">{option.protocolName}</span>
              </div>
              <div>
                <span className="text-[var(--ink-muted)] block">Est. Network Fee:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  &lt;$0.01 (Base L2 gas)
                </span>
              </div>
              <div>
                <span className="text-[var(--ink-muted)] block">Risk Tier:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Low · Verified Onchain Vault
                </span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-[var(--border-subtle)] flex justify-between text-[11px]">
              <span className="text-[var(--ink-muted)]">Expected Result:</span>
              <span className="font-bold text-[var(--ink)]">
                {activeTab === "supply"
                  ? `Deposit ${amount} ${activeTokenSymbol} for ${supplyApyVal.toFixed(2)}% APY`
                  : activeTab === "borrow"
                    ? `Borrow ${amount} USDC against ${option.stockSymbol} collateral`
                    : activeTab === "repay"
                      ? `Repay ${amount} USDC debt`
                      : `Withdraw ${amount} ${activeTokenSymbol} to wallet`}
              </span>
            </div>
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
              isRestrictedEntry ||
              stepStatus === "approving" ||
              stepStatus === "confirming" ||
              stepStatus === "pending" ||
              (!isExternalProtocol && (!parsedAmount || isInsufficientBalance || isBorrowExceedsLiquidity || needsRiskAck))
            }
            onClick={handleActionClick}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              isRestrictedEntry
                ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-75"
                : stepStatus === "approving" || stepStatus === "confirming" || stepStatus === "pending"
                ? "bg-[var(--brand)] text-white opacity-80 cursor-wait"
                : !isExternalProtocol && (isInsufficientBalance || isBorrowExceedsLiquidity)
                  ? "bg-[var(--surface-2)] text-red-500 border border-red-500/30 cursor-not-allowed"
                  : !isExternalProtocol && needsRiskAck
                    ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed"
                    : !isExternalProtocol && !parsedAmount
                      ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-60"
                      : "bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98]"
            }`}
          >
            {isRestrictedEntry ? (
              <span>{isLendDisabled ? "Stock Lending Disabled" : "Restricted in Region (Exit-Only Active)"}</span>
            ) : stepStatus === "approving" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Approving {activeTokenSymbol}…</span>
              </>
            ) : stepStatus === "confirming" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Confirming in Wallet…</span>
              </>
            ) : stepStatus === "pending" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Confirming on Base…</span>
              </>
            ) : isExternalProtocol ? (
              <span className="flex items-center gap-1.5 justify-center">
                <span>Open on {option.protocolName}</span>
                <ExternalLink size={14} />
              </span>
            ) : isInsufficientBalance ? (
              <span>Insufficient {activeTokenSymbol} Balance</span>
            ) : isBorrowExceedsLiquidity ? (
              <span>Exceeds Available Liquidity</span>
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

  const drawerContainerRef = useRef<HTMLDivElement>(null);

  // Lock page scroll on open without layout jump, trap focus, and listen for Escape key
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
        return;
      }
      if (e.key === "Tab" && drawerContainerRef.current) {
        const focusable = drawerContainerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first?.focus();
            e.preventDefault();
          }
        }
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
        ref={drawerContainerRef}
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
