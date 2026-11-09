"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Percent,
} from "lucide-react";
import type { LendingMarket, ActionModalType } from "@/lib/lending/types";
import TokenLogo from "@/components/ui/TokenLogo";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import type { ConnectionType } from "@/lib/types/wallet";
import { parseUnits, formatUnits, parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatTokenAmount } from "@/lib/launchpad/format";
import { ERC20_ABI } from "@/lib/constants/contracts";
import {
  buildAttributedApproveCall,
  buildAttributedVaultDepositCall,
  buildAttributedVaultWithdrawCall,
  buildAttributedGaugeDepositCall,
  buildAttributedGaugeWithdrawCall,
  buildAttributedMoonwellMintCall,
  buildAttributedMoonwellRedeemCall,
  buildAttributedMoonwellBorrowCall,
  buildAttributedMoonwellRepayCall,
  buildAttributedAaveSupplyCall,
  buildAttributedAaveBorrowCall,
  buildAttributedAaveRepayCall,
  buildAttributedAaveWithdrawCall,
  buildAttributedBeefyDepositCall,
  buildAttributedBeefyWithdrawCall,
  buildAttributedMorphoSupplyCollateralCall,
  buildAttributedMorphoBorrowCall,
  buildAttributedMorphoRepayCall,
  buildAttributedMorphoSupplyCall,
  buildAttributedMorphoWithdrawCollateralCall,
  buildAttributedMorphoWithdrawCall,
} from "@/lib/lending/builder-attribution";
import {
  MORPHO_ADAPTIVE_CURVE_IRM,
  MORPHO_BLUE_BASE,
  MORPHO_BLUE_ABI,
  AAVE_V3_DATA_PROVIDER_BASE,
} from "@/lib/lending/constants";
import { getMorphoMarketId } from "@/lib/lending/morpho-blue";

export default function LendingActionModal({
  market,
  initialAction = "supply",
  userAddress,
  connType,
  onClose,
  onRequestConnect,
  onSuccess,
}: {
  market: LendingMarket;
  initialAction?: ActionModalType;
  userAddress?: string | null;
  connType?: ConnectionType | null;
  onClose: () => void;
  onRequestConnect?: () => void;
  onSuccess?: () => void;
}) {
  const [action, setAction] = useState<ActionModalType>(initialAction);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "confirmed" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletBalanceRaw, setWalletBalanceRaw] = useState<bigint>(BigInt(0));
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState(false);

  const availableActions: ActionModalType[] = [];
  if (market.category === "stocks_borrow" || market.category === "crypto_borrow") {
    availableActions.push("borrow", "repay");
  } else if (market.category === "stocks_stake" || market.category === "crypto_stake") {
    availableActions.push("stake", "unstake");
  } else {
    availableActions.push("supply", "withdraw");
  }

  const activeAsset =
    action === "borrow" && market.collateralAsset
      ? market.asset
      : action === "supply" && market.collateralAsset
        ? market.collateralAsset
        : market.asset;

  useEffect(() => {
    if (!userAddress) {
      setWalletBalance(null);
      setWalletBalanceRaw(BigInt(0));
      setBalanceError(false);
      return;
    }
    let alive = true;
    setLoadingBalance(true);
    setBalanceError(false);

    async function loadBalance() {
      try {
        const pub = createBasePublicClient();
        const user = userAddress as `0x${string}`;

        if (action === "withdraw" || action === "unstake") {
          try {
            let raw = BigInt(0);
            const dec = activeAsset.decimals || 18;

            if (market.contractType === "morpho_blue") {
              const morphoParams = market.morphoParams ?? {
                loanToken: market.asset.address,
                collateralToken: market.collateralAsset?.address ?? market.asset.address,
                oracle: (market.collateralAsset?.feed as `0x${string}` | undefined) ?? "0x04689a41629776563E6822F76f2e57D148d28513",
                irm: MORPHO_ADAPTIVE_CURVE_IRM,
                lltv: BigInt(market.ltv ?? 77) * (BigInt(10) ** BigInt(16)),
              };
              const mktId = market.marketId ?? getMorphoMarketId(morphoParams);
              const pos = (await pub.readContract({
                address: MORPHO_BLUE_BASE,
                abi: MORPHO_BLUE_ABI,
                functionName: "position",
                args: [mktId, user],
              })) as [bigint, bigint, bigint];
              raw = market.category === "stocks_borrow" || market.collateralAsset ? pos[2] : pos[0];
            } else if (market.contractType === "moonwell_mtoken") {
              raw = (await pub.readContract({
                address: market.contractAddress,
                abi: parseAbi(["function balanceOfUnderlying(address) returns (uint256)"]),
                functionName: "balanceOfUnderlying",
                args: [user],
              })) as bigint;
            } else if (market.contractType === "aave_v3") {
              const aaveData = (await pub.readContract({
                address: AAVE_V3_DATA_PROVIDER_BASE,
                abi: parseAbi([
                  "function getUserReserveData(address, address) view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint40, bool)",
                ]),
                functionName: "getUserReserveData",
                args: [activeAsset.address, user],
              })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, boolean];
              raw = aaveData[0];
            } else {
              raw = (await pub.readContract({
                address: market.contractAddress,
                abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
                functionName: "balanceOf",
                args: [user],
              })) as bigint;
            }

            const human = parseFloat(formatUnits(raw, dec));
            if (!alive) return;
            setBalanceError(false);
            setWalletBalance(Number.isFinite(human) ? human : 0);
            setWalletBalanceRaw(raw);
          } catch (readErr) {
            console.error("[LendingActionModal] Failed to read position balance for withdraw:", readErr);
            if (!alive) return;
            setBalanceError(true);
            setWalletBalance(null);
            setWalletBalanceRaw(BigInt(0));
          }
          return;
        }

        const isNativeEth =
          activeAsset.address.toLowerCase() === "0x0000000000000000000000000000000000000000" ||
          activeAsset.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

        if (isNativeEth) {
          const wei = await pub.getBalance({ address: user });
          const human = parseFloat(formatUnits(wei, 18));
          if (!alive) return;
          setBalanceError(false);
          setWalletBalance(Number.isFinite(human) ? human : 0);
          setWalletBalanceRaw(wei);
        } else {
          const raw = (await pub.readContract({
            address: activeAsset.address,
            abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
            functionName: "balanceOf",
            args: [user],
          })) as bigint;
          const dec = activeAsset.decimals || 18;
          const human = parseFloat(formatUnits(raw, dec));
          if (!alive) return;
          setBalanceError(false);
          setWalletBalance(Number.isFinite(human) ? human : 0);
          setWalletBalanceRaw(raw);
        }
      } catch {
        if (!alive) return;
        setBalanceError(true);
        setWalletBalance(null);
        setWalletBalanceRaw(BigInt(0));
      } finally {
        if (alive) setLoadingBalance(false);
      }
    }

    void loadBalance();
    return () => {
      alive = false;
    };
  }, [userAddress, activeAsset.address, activeAsset.decimals, action, market]);

  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll on mount & handle Escape / focus trap
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    const origPadding = document.body.style.paddingRight;
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
      if (e.key === "Tab" && modalContainerRef.current) {
        const focusable = modalContainerRef.current.querySelectorAll<HTMLElement>(
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
      document.body.style.overflow = origOverflow;
      document.body.style.paddingRight = origPadding;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const numAmount = parseFloat(amount) || 0;
  const apyRate =
    action === "borrow"
      ? (market.borrowApr ?? 3.5) / 100
      : action === "stake"
        ? (market.stakingApr ?? market.supplyApy) / 100
        : market.supplyApy / 100;

  const estimatedYearlyYield = numAmount * apyRate;
  const estimatedDailyYield = estimatedYearlyYield / 365;

  const handleQuickPercent = (pct: number) => {
    if (!userAddress) {
      if (onRequestConnect) onRequestConnect();
      return;
    }
    if (balanceError || walletBalanceRaw <= BigInt(0)) {
      setAmount("0");
      return;
    }
    const dec = activeAsset.decimals || 18;
    if (pct === 100) {
      const isNativeEth =
        activeAsset.address.toLowerCase() === "0x0000000000000000000000000000000000000000" ||
        activeAsset.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      if (isNativeEth && walletBalanceRaw > parseUnits("0.001", 18)) {
        setAmount(formatUnits(walletBalanceRaw - parseUnits("0.001", 18), 18));
      } else {
        setAmount(formatUnits(walletBalanceRaw, dec));
      }
      return;
    }
    const computedRaw = (walletBalanceRaw * BigInt(pct)) / BigInt(100);
    setAmount(formatUnits(computedRaw, dec));
  };

  const handleExecute = async () => {
    if (!userAddress || !connType) {
      if (onRequestConnect) onRequestConnect();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount greater than 0");
      return;
    }

    const dec = activeAsset.decimals || 18;
    let parsedAmount = BigInt(0);
    try {
      parsedAmount = parseUnits(amount, dec);
    } catch {
      setErrorMessage("Invalid amount entered");
      return;
    }

    if (
      walletBalanceRaw > BigInt(0) &&
      parsedAmount > walletBalanceRaw &&
      (action === "supply" || action === "stake" || action === "repay" || action === "withdraw" || action === "unstake")
    ) {
      setErrorMessage(
        `Insufficient ${activeAsset.symbol} balance. Available: ${formatUnits(
          walletBalanceRaw,
          dec
        )} ${activeAsset.symbol}.`
      );
      return;
    }

    if (action === "borrow" && market.oracleStatus === "paused") {
      setErrorMessage(
        "Oracle is currently paused (equity market closed / feed halted). Borrowing is temporarily suspended."
      );
      return;
    }

    if (action === "borrow" && market.availableLiquidityUsd) {
      const assetPriceUsd =
        activeAsset.symbol === "USDC" || activeAsset.symbol === "USDbC" ? 1 : 100;
      const amountInUsd = numAmount * assetPriceUsd;
      if (amountInUsd > market.availableLiquidityUsd) {
        const availFormatted =
          market.availableLiquidityUsd >= 1e6
            ? `$${(market.availableLiquidityUsd / 1e6).toFixed(2)}M`
            : market.availableLiquidityUsd >= 1e3
              ? `$${(market.availableLiquidityUsd / 1e3).toFixed(1)}K`
              : `$${market.availableLiquidityUsd.toFixed(2)}`;
        setErrorMessage(
          `Insufficient market liquidity. Only ${availFormatted} available to borrow.`
        );
        return;
      }
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const calls = [];
      const user = userAddress as `0x${string}`;

      // 1. Approval call for deposits/supplies/stakes/repays if allowance is insufficient
      if (action === "supply" || action === "stake" || action === "repay") {
        // Safe approval calculation: supply & stake use exact amount; repay adds a 0.1% buffer + 1 wei
        // to cover block-by-block interest accrual between approval and transaction execution.
        const requiredAllowance =
          action === "repay"
            ? parsedAmount + (parsedAmount * BigInt(10)) / BigInt(10000) + BigInt(1)
            : parsedAmount;
        try {
          const pub = createBasePublicClient();
          const allowance = (await pub.readContract({
            address: activeAsset.address,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [user, market.contractAddress],
          })) as bigint;
          if (allowance < requiredAllowance) {
            calls.push(
              buildAttributedApproveCall(activeAsset.address, market.contractAddress, requiredAllowance)
            );
          }
        } catch {
          calls.push(
            buildAttributedApproveCall(activeAsset.address, market.contractAddress, requiredAllowance)
          );
        }
      }

      // 2. Action specific call
      if (market.contractType === "morpho_blue") {
        const morphoParams = market.morphoParams ?? {
          loanToken: market.asset.address,
          collateralToken: market.collateralAsset?.address ?? market.asset.address,
          oracle: (market.collateralAsset?.feed as `0x${string}` | undefined) ?? "0x04689a41629776563E6822F76f2e57D148d28513",
          irm: MORPHO_ADAPTIVE_CURVE_IRM,
          lltv: BigInt(market.ltv ?? 77) * (BigInt(10) ** BigInt(16)),
        };

        if (action === "borrow") {
          calls.push(buildAttributedMorphoBorrowCall(morphoParams, parsedAmount, user, user));
        } else if (action === "repay") {
          calls.push(buildAttributedMorphoRepayCall(morphoParams, parsedAmount, user));
        } else if (action === "supply") {
          if (market.category === "stocks_borrow") {
            calls.push(buildAttributedMorphoSupplyCollateralCall(morphoParams, parsedAmount, user));
          } else {
            calls.push(buildAttributedMorphoSupplyCall(morphoParams, parsedAmount, user));
          }
        } else if (action === "withdraw") {
          if (market.category === "stocks_borrow") {
            calls.push(buildAttributedMorphoWithdrawCollateralCall(morphoParams, parsedAmount, user, user));
          } else {
            calls.push(buildAttributedMorphoWithdrawCall(morphoParams, parsedAmount, user, user));
          }
        }
      } else if (market.contractType === "morpho_vault") {
        if (action === "supply") {
          calls.push(buildAttributedVaultDepositCall(market.contractAddress, parsedAmount, user));
        } else if (action === "withdraw") {
          calls.push(buildAttributedVaultWithdrawCall(market.contractAddress, parsedAmount, user, user));
        }
      } else if (market.contractType === "aerodrome_gauge") {
        if (action === "stake" || action === "supply") {
          calls.push(buildAttributedGaugeDepositCall(market.contractAddress, parsedAmount));
        } else if (action === "withdraw" || action === "unstake") {
          calls.push(buildAttributedGaugeWithdrawCall(market.contractAddress, parsedAmount));
        }
      } else if (market.contractType === "moonwell_mtoken") {
        if (action === "supply") {
          calls.push(buildAttributedMoonwellMintCall(market.contractAddress, parsedAmount));
        } else if (action === "withdraw") {
          calls.push(buildAttributedMoonwellRedeemCall(market.contractAddress, parsedAmount));
        } else if (action === "borrow") {
          calls.push(buildAttributedMoonwellBorrowCall(market.contractAddress, parsedAmount));
        } else if (action === "repay") {
          calls.push(buildAttributedMoonwellRepayCall(market.contractAddress, parsedAmount));
        }
      } else if (market.contractType === "aave_v3") {
        if (action === "supply") {
          calls.push(buildAttributedAaveSupplyCall(activeAsset.address, parsedAmount, user));
        } else if (action === "borrow") {
          calls.push(buildAttributedAaveBorrowCall(activeAsset.address, parsedAmount, user));
        } else if (action === "repay") {
          calls.push(buildAttributedAaveRepayCall(activeAsset.address, parsedAmount, user));
        } else if (action === "withdraw") {
          calls.push(buildAttributedAaveWithdrawCall(activeAsset.address, parsedAmount, user));
        }
      } else if (market.contractType === "beefy_vault") {
        if (action === "supply" || action === "stake") {
          calls.push(buildAttributedBeefyDepositCall(market.contractAddress, parsedAmount));
        } else if (action === "withdraw" || action === "unstake") {
          calls.push(buildAttributedBeefyWithdrawCall(market.contractAddress, parsedAmount));
        }
      } else {
        if (action === "supply" || action === "stake") {
          calls.push(buildAttributedVaultDepositCall(market.contractAddress, parsedAmount, user));
        } else if (action === "withdraw" || action === "unstake") {
          calls.push(buildAttributedVaultWithdrawCall(market.contractAddress, parsedAmount, user, user));
        }
      }

      if (calls.length === 0) {
        setStatus("error");
        setErrorMessage(`Action "${action}" is not supported here for ${market.protocolLabel || market.name}.`);
        return;
      }

      const hash = await sendAppTransactions(connType, userAddress, calls, {
        atomicBatch: true,
      });

      setTxHash(hash);

      // Wait for confirmed receipt
      const pub = createBasePublicClient();
      const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status === "reverted") {
        setStatus("error");
        setErrorMessage("Transaction reverted on-chain. Please verify token balance and parameters.");
        return;
      }

      setStatus("confirmed");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error("[LendingActionModal] Error executing action:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/reject|denied|cancel|4001/i.test(msg)) {
        setErrorMessage("Transaction signature was cancelled in wallet.");
      } else if (/insufficient funds/i.test(msg)) {
        setErrorMessage("Insufficient ETH in wallet to cover network gas fees.");
      } else {
        setErrorMessage(msg.slice(0, 180));
      }
      setStatus("error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        ref={modalContainerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lending-modal-title"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-5">
          <div className="flex items-center gap-3">
            <TokenLogo
              address={activeAsset.address}
              symbol={activeAsset.symbol}
              size={40}
              shape="rounded-xl"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 id="lending-modal-title" className="font-bold text-[var(--ink)] text-base">{market.name}</h3>
                {market.isStockFocus && (
                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                    Stock RWA
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1">
                <span>{market.protocolLabel}</span>
                <span>·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {market.category === "stocks_borrow" || market.category === "crypto_borrow"
                    ? `${market.borrowApr}% Borrow APR`
                    : `${market.supplyApy}% Supply APY`}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Action Tabs */}
          <div className="flex rounded-xl bg-[var(--surface-2)] p-1 border border-[var(--border-subtle)]">
            {availableActions.map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => {
                  setAction(act);
                  setStatus("idle");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                  action === act
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm border border-[var(--border-subtle)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Oracle Status Alert */}
          {market.oracleStatus === "paused" && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>⚠️ Oracle Paused (Feed Halted / Weekend Close) — Borrowing against this stock is temporarily suspended by Morpho risk rules.</span>
            </div>
          )}

          {/* Amount Input */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
              <span>Amount to {action}</span>
              <div className="flex items-center gap-1.5">
                <span>{action === "withdraw" || action === "unstake" ? "Supplied:" : "Balance:"}</span>
                {userAddress ? (
                  loadingBalance ? (
                    <Loader2 size={11} className="inline animate-spin opacity-60" />
                  ) : balanceError ? (
                    <span className="font-semibold text-rose-500 text-[11px] flex items-center gap-1">
                      <AlertCircle size={11} /> Position read failed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(100)}
                      className={`font-semibold hover:underline flex items-center gap-1 ${
                        (walletBalance ?? 0) > 0 ? "text-[var(--ink)]" : "text-amber-600 dark:text-amber-400"
                      }`}
                      title="Click to set MAX"
                    >
                      <span>{walletBalance != null ? formatTokenAmount(walletBalance, activeAsset.decimals) : "0"}</span>
                      <span>{activeAsset.symbol}</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={onRequestConnect}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    const dec = activeAsset.decimals || 18;
                    if (val.includes(".")) {
                      const [, decPart] = val.split(".");
                      if (decPart && decPart.length > dec) return;
                    }
                    setAmount(val);
                    setStatus("idle");
                    setErrorMessage(null);
                  }
                }}
                className="w-full bg-transparent text-2xl font-bold font-mono text-[var(--ink)] focus:outline-none"
              />
              <span className="font-semibold text-sm text-[var(--ink)] px-2.5 py-1 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg shrink-0">
                {activeAsset.symbol}
              </span>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                {[25, 50, 75, 100].map((pct) => {
                  const isZero = userAddress && (walletBalance === 0 || walletBalanceRaw <= BigInt(0));
                  return (
                    <button
                      key={pct}
                      type="button"
                      disabled={balanceError || (userAddress ? walletBalanceRaw <= BigInt(0) : false)}
                      onClick={() => handleQuickPercent(pct)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                        isZero || balanceError
                          ? "opacity-60 border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)]"
                      }`}
                    >
                      {pct === 100 ? (isZero ? "MAX (0)" : "MAX") : `${pct}%`}
                    </button>
                  );
                })}
              </div>
              {userAddress && !balanceError && walletBalance === 0 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  0 {activeAsset.symbol} available
                </span>
              )}
            </div>
          </div>

          {/* Exact Allowance Notice */}
          {(action === "supply" || action === "stake" || action === "repay") && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] px-1 select-none">
              <ShieldCheck size={13} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Exact allowance: approval is strictly scoped to this action{action === "repay" ? " (+0.1% interest buffer)" : ""}.</span>
            </div>
          )}

          {/* Metrics Preview */}
          <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2 text-xs bg-[var(--surface)]">
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Protocol</span>
              <a
                href={market.protocolUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--ink)] hover:underline flex items-center gap-1"
              >
                {market.protocolLabel}
                <ExternalLink size={11} />
              </a>
            </div>
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Rate / APY</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Percent size={12} />
                {action === "borrow" ? `${market.borrowApr}% Borrow APR` : `${market.supplyApy}% Supply APY`}
              </span>
            </div>
            {market.ltv && (
              <div className="flex justify-between text-[var(--ink-muted)]">
                <span>Maximum Loan-To-Value (LLTV)</span>
                <span className="font-semibold text-[var(--ink)]">{market.ltv}%</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Oracle Reference</span>
              <span className="font-mono text-[11px] text-[var(--ink)]">{market.oracle}</span>
            </div>

            {market.utilization && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
                <div className="flex justify-between text-[11px] text-[var(--ink-muted)]">
                  <span>Market Utilization</span>
                  <span className="font-semibold text-[var(--ink)]">{market.utilization.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[var(--surface-2)] h-1.5 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, market.utilization)}%` }}
                  />
                </div>
              </div>
            )}
            {numAmount > 0 && (
              <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-between items-center text-[var(--ink)]">
                <span className="flex items-center gap-1 text-[var(--ink-muted)]">
                  <TrendingUp size={12} className="text-emerald-700 dark:text-emerald-400" />
                  Est. Yearly Return
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {estimatedYearlyYield.toFixed(activeAsset.decimals === 6 ? 2 : 4)} {activeAsset.symbol} (~${estimatedDailyYield.toFixed(2)}/day)
                </span>
              </div>
            )}
          </div>

          {/* Direct Base Mainnet Execution */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <div className="text-[11px] min-w-0">
              <p className="font-semibold text-[var(--ink)]">
                Direct Base Mainnet Execution
              </p>
              <p className="text-[var(--ink-muted)] text-[10px]">
                Transactions route directly to verified Morpho, Aerodrome &amp; Superform contracts on Base.
              </p>
            </div>
          </div>

          {/* Error & Success States */}
          {errorMessage && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="break-all">{errorMessage}</p>
            </div>
          )}

          {status === "confirmed" && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="font-bold">Transaction Confirmed on Base!</p>
                {txHash && (
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-[11px] font-mono mt-0.5 block hover:opacity-80"
                  >
                    View on Basescan ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Pre-signing Confirmation Summary */}
          {numAmount > 0 && status !== "confirmed" && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 space-y-2 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
                Transaction Confirmation Summary
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[var(--ink-muted)] block">Amount:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">
                    {amount} {activeAsset.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--ink-muted)] block">Protocol:</span>
                  <span className="font-semibold text-[var(--ink)]">{market.protocolLabel}</span>
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
                    Low · Verified Contract
                  </span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-[var(--border-subtle)] flex justify-between text-[11px]">
                <span className="text-[var(--ink-muted)]">Expected Result:</span>
                <span className="font-bold text-[var(--ink)]">
                  {action === "supply" || action === "stake"
                    ? `Supply ${amount} ${activeAsset.symbol} for ${market.supplyApy}% APY`
                    : action === "borrow"
                      ? `Borrow ${amount} ${activeAsset.symbol} against collateral`
                      : action === "repay"
                        ? `Repay ${amount} ${activeAsset.symbol} debt`
                        : `Withdraw ${amount} ${activeAsset.symbol} to wallet`}
                </span>
              </div>
            </div>
          )}

          {/* Action CTA */}
          <div className="pt-2">
            {!userAddress ? (
              <button
                type="button"
                onClick={onRequestConnect}
                className="w-full py-3 rounded-xl font-bold text-sm bg-[var(--brand)] text-white hover:opacity-90 transition-all shadow-md cursor-pointer"
              >
                Connect Wallet to {action.toUpperCase()}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecute}
                disabled={
                  status === "submitting" ||
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  (balanceError && (action === "withdraw" || action === "unstake"))
                }
                className="w-full py-3 rounded-xl font-bold text-sm bg-[var(--brand)] text-white hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 shadow-md transition-all cursor-pointer"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Confirming on Base…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>{action.toUpperCase()} {amount ? `${amount} ${activeAsset.symbol}` : ""}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
