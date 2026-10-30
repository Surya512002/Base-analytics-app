"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Percent,
} from "lucide-react";
import type { LendingMarket, ActionModalType } from "@/lib/lending/types";
import TokenLogo from "@/components/ui/TokenLogo";
import { BUILDER_CODE } from "@/lib/constants/env";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import type { ConnectionType } from "@/lib/types/wallet";
import { parseUnits, maxUint256, formatUnits, parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatTokenAmount } from "@/lib/launchpad/format";
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
  buildAttributedBeefyDepositCall,
  buildAttributedBeefyWithdrawCall,
  buildAttributedMorphoSupplyCollateralCall,
  buildAttributedMorphoBorrowCall,
  buildAttributedMorphoRepayCall,
  buildAttributedMorphoSupplyCall,
  buildAttributedMorphoWithdrawCollateralCall,
  buildAttributedMorphoWithdrawCall,
} from "@/lib/lending/builder-attribution";
import { MORPHO_ADAPTIVE_CURVE_IRM } from "@/lib/lending/constants";

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
      return;
    }
    let alive = true;
    setLoadingBalance(true);

    async function loadBalance() {
      try {
        const pub = createBasePublicClient();
        const user = userAddress as `0x${string}`;

        if (action === "withdraw" || action === "unstake") {
          try {
            const raw = await pub.readContract({
              address: market.contractAddress,
              abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
              functionName: "balanceOf",
              args: [user],
            });
            const dec = activeAsset.decimals || 18;
            const human = parseFloat(formatUnits(raw, dec));
            if (!alive) return;
            setWalletBalance(Number.isFinite(human) ? human : 0);
            setWalletBalanceRaw(raw);
          } catch {
            if (!alive) return;
            setWalletBalance(0);
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
          setWalletBalance(Number.isFinite(human) ? human : 0);
          setWalletBalanceRaw(wei);
        } else {
          const raw = await pub.readContract({
            address: activeAsset.address,
            abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
            functionName: "balanceOf",
            args: [user],
          });
          const dec = activeAsset.decimals || 18;
          const human = parseFloat(formatUnits(raw, dec));
          if (!alive) return;
          setWalletBalance(Number.isFinite(human) ? human : 0);
          setWalletBalanceRaw(raw);
        }
      } catch {
        if (!alive) return;
        setWalletBalance(0);
        setWalletBalanceRaw(BigInt(0));
      } finally {
        if (alive) setLoadingBalance(false);
      }
    }

    void loadBalance();
    return () => {
      alive = false;
    };
  }, [userAddress, activeAsset.address, activeAsset.decimals, action, market.contractAddress]);

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
    const bal = walletBalance ?? 0;
    if (bal <= 0) {
      setAmount("0");
      return;
    }
    const dec = activeAsset.decimals || 18;
    if (pct === 100) {
      if (walletBalanceRaw > BigInt(0)) {
        const isNativeEth =
          activeAsset.address.toLowerCase() === "0x0000000000000000000000000000000000000000" ||
          activeAsset.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        if (isNativeEth && walletBalanceRaw > parseUnits("0.001", 18)) {
          setAmount(formatUnits(walletBalanceRaw - parseUnits("0.001", 18), 18));
        } else {
          setAmount(formatUnits(walletBalanceRaw, dec));
        }
      } else {
        setAmount(bal.toString());
      }
      return;
    }
    const val = (bal * pct) / 100;
    const fractionDec = Math.min(dec === 6 ? 2 : dec === 8 ? 4 : 4, dec);
    setAmount(val.toFixed(fractionDec));
  };

  const handleExecute = async () => {
    if (!userAddress || !connType) {
      if (onRequestConnect) onRequestConnect();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter an amount");
      return;
    }

    const numAmount = parseFloat(amount);
    if (
      walletBalance != null &&
      numAmount > walletBalance &&
      (action === "supply" || action === "stake" || action === "repay" || action === "withdraw" || action === "unstake")
    ) {
      setErrorMessage(
        `Insufficient ${activeAsset.symbol} balance. Available balance: ${formatTokenAmount(
          walletBalance,
          activeAsset.decimals
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

    if (action === "borrow" && market.availableLiquidityUsd && numAmount > market.availableLiquidityUsd) {
      setErrorMessage(
        `Insufficient market liquidity. Only $${(market.availableLiquidityUsd / 1e6).toFixed(
          1
        )}M available to borrow.`
      );
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const parsedAmount = parseUnits(amount, activeAsset.decimals);
      const calls = [];
      const user = userAddress as `0x${string}`;

      // 1. Approval call for deposits/supplies/stakes/repays
      if (action === "supply" || action === "stake" || action === "repay") {
        calls.push(
          buildAttributedApproveCall(activeAsset.address, market.contractAddress, maxUint256)
        );
      }

      // 2. Action specific call
      if (market.contractType === "morpho_blue") {
        const morphoParams = market.morphoParams ?? {
          loanToken: market.asset.address,
          collateralToken: market.collateralAsset?.address ?? market.asset.address,
          oracle: (market.collateralAsset as any)?.feed ?? "0x04689a41629776563E6822F76f2e57D148d28513",
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
        } else {
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
        }
      } else if (market.contractType === "beefy_vault") {
        if (action === "supply" || action === "stake") {
          calls.push(buildAttributedBeefyDepositCall(market.contractAddress, parsedAmount));
        } else {
          calls.push(buildAttributedBeefyWithdrawCall(market.contractAddress, parsedAmount));
        }
      } else {
        // Fallback standard vault deposit/stake
        calls.push(buildAttributedVaultDepositCall(market.contractAddress, parsedAmount, user));
      }

      const hash = await sendAppTransactions(connType, userAddress, calls, {
        atomicBatch: true,
      });

      setTxHash(hash);
      setStatus("confirmed");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error("[LendingActionModal] Error executing action:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/reject|denied|cancel|4001/i.test(msg)) {
        setErrorMessage("Transaction signature was cancelled in wallet.");
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
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-2xl overflow-hidden"
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
                <h3 className="font-bold text-[var(--ink)] text-base">{market.name}</h3>
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
                <span>Balance:</span>
                {userAddress ? (
                  loadingBalance ? (
                    <Loader2 size={11} className="inline animate-spin opacity-60" />
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
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setStatus("idle");
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
                  const isZero = userAddress && walletBalance === 0;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickPercent(pct)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                        isZero
                          ? "opacity-60 border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-amber-500/40"
                          : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)]"
                      }`}
                    >
                      {pct === 100 ? (isZero ? "MAX (0)" : "MAX") : `${pct}%`}
                    </button>
                  );
                })}
              </div>
              {userAddress && walletBalance === 0 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  0 {activeAsset.symbol} in wallet
                </span>
              )}
            </div>
          </div>

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

          {/* Action CTA */}
          <div className="pt-2">
            {!userAddress ? (
              <button
                type="button"
                onClick={onRequestConnect}
                className="w-full btn-primary py-3 rounded-xl font-bold text-sm shadow-md"
              >
                Connect Wallet to {action.toUpperCase()}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecute}
                disabled={status === "submitting" || !amount || parseFloat(amount) <= 0}
                className="w-full btn-primary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md transition-all"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Confirming on Base…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    {action.toUpperCase()} {amount ? `${amount} ${activeAsset.symbol}` : ""}
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
