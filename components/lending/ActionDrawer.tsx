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
import { isUnlimitedApprovalAllowed } from "@/lib/security/trusted-spenders";
import { useAaveV4 } from "./useAaveV4";
import { AAVE_V4_RESERVES, AAVE_V4_SPOKE, AAVE_V4_SPOKE_ABI } from "@/lib/lending/aave-v4/constants";
import { borrowPower, healthFactor, healthLevel, liquidationPrice, maxBorrowUsd, maxWithdrawPowerUsd, MIN_HEALTH_FACTOR, SAFE_HEALTH_FACTOR } from "@/lib/lending/aave-v4/math";
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
import { parseUnits, formatUnits, maxUint256, parseAbi } from "viem";
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
import { simulateCallsBeforeExecution } from "@/lib/utils/tx-simulation";
import { getTokenizedStockBySymbol } from "@/lib/stocks/tokenized-stocks-registry";
import { useCompliance } from "@/hooks/useCompliance";

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
  const [approveUnlimited, setApproveUnlimited] = useState(false);
  const compliance = useCompliance();
  const isV4 = option?.executionType === "aave_v4";
  const v4 = useAaveV4(isV4, userAddress);

  // Balances: floats for display and BigInts for exact on-chain calculations
  const [stockBalance, setStockBalance] = useState<number>(0);
  const [rawStockBalance, setRawStockBalance] = useState<bigint>(BigInt(0));
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [rawUsdcBalance, setRawUsdcBalance] = useState<bigint>(BigInt(0));
  const [suppliedBalance, setSuppliedBalance] = useState<number>(0);
  const [rawSuppliedBalance, setRawSuppliedBalance] = useState<bigint>(BigInt(0));
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

  // Resolve decimals dynamically from token registry (defaults to 8 for B20 stocks)
  const stockEntry = option?.stockSymbol ? getTokenizedStockBySymbol(option.stockSymbol) : undefined;
  const stockDecimals = stockEntry?.decimals ?? 8;
  const loanDecimals = 6; // Canonical USDC decimals on Base
  const activeDecimals =
    activeTab === "borrow" || activeTab === "repay" ? loanDecimals : stockDecimals;

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

  // Fetch onchain balances: wallet stock, wallet USDC, and supplied position
  useEffect(() => {
    if (!userAddress || !option?.stockAddress) return;
    let alive = true;
    setLoadingBalances(true);

    async function loadBalances() {
      try {
        const pub = createBasePublicClient();
        const user = userAddress as `0x${string}`;

        // 1. Read wallet token balances
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

        // 2. Read supplied/collateralized balance in this specific protocol/market
        let suppliedBal = BigInt(0);
        try {
          if (option!.executionType === "morpho_blue" && option!.morphoParams) {
            const marketId = getMorphoMarketId(option!.morphoParams);
            const pos = await pub.readContract({
              address: MORPHO_BLUE_BASE,
              abi: MORPHO_BLUE_ABI,
              functionName: "position",
              args: [marketId, user],
            });
            const [, , collateral] = pos as [bigint, bigint, bigint];
            suppliedBal = collateral;
          } else if (option!.executionType === "aave_v4") {
            const reserve = Object.values(AAVE_V4_RESERVES).find((r) => r.address.toLowerCase() === option!.stockAddress.toLowerCase());
            if (reserve) {
              suppliedBal = (await pub.readContract({
                address: AAVE_V4_SPOKE,
                abi: AAVE_V4_SPOKE_ABI,
                functionName: "getUserSuppliedAssets",
                args: [reserve.id, user],
              })) as bigint;
            }
          } else if (option!.executionType === "aave") {
            const data = await pub.readContract({
              address: AAVE_V3_DATA_PROVIDER_BASE,
              abi: parseAbi([
                "function getUserReserveData(address asset, address user) external view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
              ]),
              functionName: "getUserReserveData",
              args: [option!.stockAddress, user],
            });
            suppliedBal = data[0];
          } else if (
            option!.executionType === "beefy" ||
            option!.executionType === "aerodrome" ||
            option!.executionType === "pendle" ||
            option!.executionType === "ipor"
          ) {
            suppliedBal = (await pub.readContract({
              address: option!.contractAddress,
              abi: parseAbi(["function balanceOf(address account) view returns (uint256)"]),
              functionName: "balanceOf",
              args: [user],
            })) as bigint;
          }
        } catch {
          suppliedBal = BigInt(0);
        }

        if (alive) {
          setRawStockBalance(stockBalRaw);
          setStockBalance(parseFloat(formatUnits(stockBalRaw, stockDecimals)));
          setRawUsdcBalance(usdcBalRaw);
          setUsdcBalance(parseFloat(formatUnits(usdcBalRaw, loanDecimals)));
          setRawSuppliedBalance(suppliedBal);
          setSuppliedBalance(parseFloat(formatUnits(suppliedBal, stockDecimals)));
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
  }, [userAddress, option, stockDecimals]);

  // Safe Guard: Never show blank panel if option is missing or undefined
  if (!option || !option.stockSymbol) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md h-auto max-h-[90dvh] sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] bg-[var(--surface-3)] border-t sm:border border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        <div className="p-5 pb-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <span className="font-mono font-bold text-sm text-[var(--ink)]">Market Action</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close action drawer"
            className="p-1.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition cursor-pointer"
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
  const activeTokenSymbol =
    activeTab === "borrow" || activeTab === "repay" ? "USDC" : option.stockSymbol;

  // Available balance for the active tab:
  // - Supply: user's stock wallet balance
  // - Withdraw: user's supplied position in this market
  // - Borrow: market liquidity available in USDC
  // - Repay: user's USDC wallet balance
  const baseAvailableBalance =
    activeTab === "borrow"
      ? (option.availableLiquidityUsd ?? 0)
      : activeTab === "repay"
      ? usdcBalance
      : activeTab === "withdraw"
      ? suppliedBalance
      : stockBalance;

  const baseAvailableRaw =
    activeTab === "borrow"
      ? parseUnits(Math.floor(option.availableLiquidityUsd ?? 0).toString(), loanDecimals)
      : activeTab === "repay"
      ? rawUsdcBalance
      : activeTab === "withdraw"
      ? rawSuppliedBalance
      : rawStockBalance;

  // Aave V4: what you can borrow or withdraw is limited by your own collateral, and the MAX button stops at a
  // safe health factor, not at the liquidation line.
  const v4Stock = isV4 ? v4.overview?.stocks.find((x) => x.address.toLowerCase() === option.stockAddress.toLowerCase()) : undefined;
  const v4Lines = (v4.position?.collateral ?? []).map((c) => ({ usd: c.usd, collateralFactor: c.collateralFactor, on: c.collateralOn }));
  const v4Power = borrowPower(v4Lines);
  const v4Debt = v4.position?.debtUsdc ?? 0;
  const v4PerToken = v4Stock ? (v4Stock.priceUsd * v4Stock.collateralFactor) / 100 : 0; // borrow power per stock token
  const v4Avail: number | null = !isV4
    ? null
    : activeTab === "borrow"
      ? Math.min(option.availableLiquidityUsd ?? 0, maxBorrowUsd(v4Power, v4Debt))
      : activeTab === "repay"
        ? Math.min(usdcBalance, v4Debt)
        : activeTab === "withdraw"
          ? v4PerToken > 0
            ? Math.min(suppliedBalance, maxWithdrawPowerUsd(v4Power, v4Debt) / v4PerToken)
            : 0
          : null;
  const trimNum = (n: number, d: number) => {
    const f = Math.floor(Math.max(0, n) * 10 ** d) / 10 ** d;
    return f.toFixed(d);
  };
  const currentAvailableBalance = v4Avail ?? baseAvailableBalance;
  const currentAvailableRaw =
    v4Avail != null ? parseUnits(trimNum(v4Avail, activeDecimals), activeDecimals) : baseAvailableRaw;

  const parsedAmount = parseFloat(amount) || 0;

  // Aave V4: the health factor after this action (an estimate; the contract has the final say)
  const v4Collateral = v4.position?.collateral.find((c) => c.symbol === option.stockSymbol);
  const v4AfterPower =
    activeTab === "supply"
      ? v4Power + (v4Collateral?.collateralOn === false ? (v4Collateral.usd * v4Collateral.collateralFactor) / 100 : 0) + parsedAmount * v4PerToken
      : activeTab === "withdraw"
        ? Math.max(0, v4Power - parsedAmount * v4PerToken)
        : v4Power;
  const v4AfterDebt = activeTab === "borrow" ? v4Debt + parsedAmount : activeTab === "repay" ? Math.max(0, v4Debt - parsedAmount) : v4Debt;
  const v4HfAfter = healthFactor(v4AfterPower, v4AfterDebt);
  const v4Level = healthLevel(v4HfAfter);
  const v4Blocks = isV4 && parsedAmount > 0 && (activeTab === "borrow" || activeTab === "withdraw") && v4Level === "blocked";

  // Validation checks
  const isInsufficientBalance =
    activeTab === "supply"
      ? parsedAmount > stockBalance
      : activeTab === "repay"
      ? parsedAmount > usdcBalance || (isV4 && parsedAmount > v4Debt + 0.01)
      : activeTab === "withdraw"
      ? (suppliedBalance <= 0 || parsedAmount > suppliedBalance)
      : false;

  const isExceedsLiquidity =
    (activeTab === "borrow" &&
      option.availableLiquidityUsd != null &&
      option.availableLiquidityUsd > 0 &&
      parsedAmount > option.availableLiquidityUsd) ||
    // Aave V4: more than your collateral allows
    (isV4 && activeTab === "borrow" && parsedAmount > maxBorrowUsd(v4Power, v4Debt, 1.0001)) ||
    v4Blocks;

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
  const monthlyBorrowCost = (parsedAmount * ((option.borrowApr ?? 3.5) / 100)) / 12;

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
      const targetUrl =
        option.protocol === "aave"
          ? (activeTab === "borrow" ? "https://pro.aave.com/explore/borrow" : "https://pro.aave.com/explore")
          : option.protocol === "ipor"
          ? "https://app.ipor.io/stocks"
          : option.protocol === "aerodrome"
          ? (option.sourceLink || "https://aerodrome.finance/pools")
          : (option.sourceLink || "https://app.beefy.com");

      if (typeof window !== "undefined") {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) return;
    if (isInsufficientBalance || isExceedsLiquidity) return;
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
          const allowance = await pub.readContract({
            address: targetToken,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [user, option.contractAddress],
          });
          requiresApproval = (allowance as bigint) < amountRaw;
        } catch {
          requiresApproval = true;
        }
      }

      const approveAmount = approveUnlimited && isUnlimitedApprovalAllowed(option.contractAddress) ? maxUint256 : amountRaw;

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
        approveAmount,
        collateralAlreadyOn: v4Collateral?.collateralOn ?? false,
      });

      if (calls.length === 0) {
        setStepStatus("error");
        setErrorMessage("Action not supported for this protocol contract type.");
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

      // Fund-Safety: Await verified on-chain confirmation before declaring success
      const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status === "success") {
        setStepStatus("success");
        onSuccess?.();
      } else {
        setStepStatus("error");
        setErrorMessage("Transaction was reverted on-chain. Please check your transaction parameters and try again.");
      }
    } catch (e) {
      setStepStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const setPercentAmount = (pct: number) => {
    if (currentAvailableRaw <= BigInt(0)) return;
    if (pct === 100) {
      setAmount(formatUnits(currentAvailableRaw, activeDecimals));
    } else {
      const calculatedRaw = (currentAvailableRaw * BigInt(pct)) / BigInt(100);
      const str = formatUnits(calculatedRaw, activeDecimals);
      const trimmed = str.includes(".") ? str.replace(/\.?0+$/, "") : str;
      setAmount(trimmed);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md h-auto max-h-[90dvh] sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] bg-[var(--surface-3)] border-t sm:border border-[var(--border-subtle)] shadow-2xl flex flex-col min-h-0 overflow-hidden rounded-t-3xl sm:rounded-3xl"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER (Pinned at Top)
          ───────────────────────────────────────────────────────────── */}
      <div className="pulse-surface shrink-0 rounded-none p-5 pb-4 shadow-none space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="pulse-eyebrow mb-1.5">
              <span className="pulse-status-dot" aria-hidden /> {option.protocolName}
            </p>
            <div className="flex items-center gap-2">
              <span id="action-drawer-title" className="font-mono font-black text-xl text-[var(--ink)]">
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
        <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-white/12 border border-white/20">
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
                className={`py-1.5 rounded-full text-xs font-bold capitalize transition cursor-pointer ${
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
              Deposit <strong>{option.stockSymbol}</strong> collateral to borrow USDC at up to 75% Max LTV with Chainlink equity price feeds. Or manage directly on Aave Pro:
            </p>
            {option.sourceLink && (
              <a
                href={option.sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-subtle)] hover:border-[var(--brand-text)] font-bold text-[11px] transition"
              >
                <span>Open Aave Pro App</span>
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

        {/* Direct Protocol Action Inputs vs. External Protocol Gateway */}
        {!isExternalProtocol ? (
          <>
            {isV4 && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs space-y-1.5" aria-label="Your Aave V4 position">
                <div className="flex justify-between"><span className="text-[var(--ink-muted)]">Collateral value</span><b className="font-mono text-[var(--ink)]">${v4.position ? v4.position.collateral.reduce((a, c) => a + c.usd, 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</b></div>
                <div className="flex justify-between"><span className="text-[var(--ink-muted)]">USDC borrowed</span><b className="font-mono text-[var(--ink)]">${v4.position ? v4Debt.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</b></div>
                <div className="flex justify-between"><span className="text-[var(--ink-muted)]">Health factor now</span><b className="font-mono text-[var(--ink)]">{v4.position?.healthFactor != null ? v4.position.healthFactor.toFixed(2) : v4.position ? "no debt" : "—"}</b></div>
                {parsedAmount > 0 && (
                  <div className="flex justify-between"><span className="text-[var(--ink-muted)]">Health factor after (estimate)</span>
                    <b className={`font-mono ${v4Level === "blocked" || v4Level === "danger" ? "text-red-500" : v4Level === "watch" ? "text-amber-500" : "text-emerald-500"}`}>{v4HfAfter != null ? v4HfAfter.toFixed(2) : "no debt"}</b>
                  </div>
                )}
                {v4Stock && v4Debt > 0 && (() => {
                  const lp = liquidationPrice(v4Stock.priceUsd, v4Power, v4Debt, (v4Collateral?.usd ?? 0) * v4Stock.collateralFactor / 100);
                  return lp != null ? <div className="flex justify-between"><span className="text-[var(--ink-muted)]">{option.stockSymbol} liquidation price</span><b className="font-mono text-[var(--ink)]">${lp.toFixed(2)}</b></div> : null;
                })()}
                <p className="pt-1 text-[11px] leading-snug text-[var(--ink-muted)]">
                  {v4Level === "blocked" && (activeTab === "borrow" || activeTab === "withdraw")
                    ? `This would leave your health factor under ${MIN_HEALTH_FACTOR}, too close to liquidation. Try a smaller amount.`
                    : `MAX stops at a health factor of ${SAFE_HEALTH_FACTOR}. Below 1.0 your stock collateral can be sold to repay the loan. Stocks here can only be used as collateral: they earn no yield and can't be borrowed. Not available to people in the US.`}
                </p>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[var(--ink)]">
                  {activeTab === "supply"
                    ? "Amount to Supply"
                    : activeTab === "withdraw"
                    ? "Amount to Withdraw"
                    : activeTab === "borrow"
                    ? "Amount to Borrow"
                    : "Amount to Repay"}
                </label>
                <span className="text-[var(--ink-muted)]">
                  {activeTab === "withdraw" ? "Supplied: " : activeTab === "borrow" ? "Market Liquidity: " : "In Wallet: "}
                  {loadingBalances ? (
                    <span className="inline-block w-16 h-3 rounded bg-[var(--border-subtle)] animate-pulse align-middle" />
                  ) : (
                    <strong className="text-[var(--ink)] font-mono">
                      {activeTab === "borrow"
                        ? `$${(option.availableLiquidityUsd ?? 0).toLocaleString()} USDC`
                        : `${currentAvailableBalance.toFixed(activeDecimals === 6 ? 2 : 4)} ${activeTokenSymbol}`}
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

              {/* Unlimited Approval Toggle (for Supply & Repay actions) */}
              {(activeTab === "supply" || activeTab === "repay") && isUnlimitedApprovalAllowed(option.contractAddress) && (
                <label className="flex items-center gap-2 pt-1 text-xs text-[var(--ink-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approveUnlimited}
                    onChange={(e) => setApproveUnlimited(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[var(--brand)] accent-[var(--brand)]"
                  />
                  <span className="text-[11px]">Approve unlimited allowance (saves gas on future actions)</span>
                </label>
              )}
            </div>

            {/* Live Transaction Preview */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2.5 text-xs">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
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
                  <p className="text-[11px] text-[var(--ink-dim)]">
                    Morpho Midnight guarantees this fixed rate until term maturity.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-2.5 text-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
              External Protocol Integration
            </span>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              This pool is deployed directly on <strong>{option.protocolName}</strong> on Base. Click below to open the official verified pool where you can connect your wallet and execute transactions natively.
            </p>
          </div>
        )}

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
            <p className="text-[11px] text-[var(--ink-muted)] italic">
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

        {/* Pending Receipt (Waiting for Block Confirmation) */}
        {stepStatus === "pending" && txHash && (
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <Loader2 size={15} className="animate-spin text-blue-600 dark:text-blue-400" />
              <span>Confirming on Base Mainnet…</span>
            </div>
            <p className="text-[11px]">Transaction submitted to Base. Waiting for block confirmation.</p>
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-text)] hover:underline pt-0.5"
            >
              <span>View Pending Tx on BaseScan</span>
              <ExternalLink size={11} />
            </a>
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
        ) : isExternalProtocol ? (
          <button
            type="button"
            disabled={isRestrictedEntry}
            onClick={handleActionClick}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[var(--brand)] text-white hover:opacity-90 shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>Open on {option.protocolName}</span>
            <ExternalLink size={15} />
          </button>
        ) : (
          <button
            type="button"
            disabled={
              isRestrictedEntry ||
              stepStatus === "approving" ||
              stepStatus === "confirming" ||
              stepStatus === "pending" ||
              (!parsedAmount || isInsufficientBalance || isExceedsLiquidity || needsRiskAck)
            }
            onClick={handleActionClick}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              isRestrictedEntry
                ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-75"
                : stepStatus === "approving" || stepStatus === "confirming" || stepStatus === "pending"
                ? "bg-[var(--brand)] text-white opacity-80 cursor-wait"
                : isInsufficientBalance
                  ? "bg-[var(--surface-2)] text-red-500 border border-red-500/30 cursor-not-allowed"
                  : isExceedsLiquidity
                    ? "bg-[var(--surface-2)] text-red-500 border border-red-500/30 cursor-not-allowed"
                    : needsRiskAck
                      ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed"
                      : !parsedAmount
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
                <span>Confirming on Base (waiting for receipt)…</span>
              </>
            ) : isInsufficientBalance ? (
              <span>
                {activeTab === "withdraw"
                  ? "Insufficient Supplied Balance"
                  : `Insufficient ${activeTokenSymbol} Balance`}
              </span>
            ) : isExceedsLiquidity ? (
              <span>Exceeds Available Market Liquidity</span>
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
