"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, AlertTriangle, Loader2, X } from "lucide-react";
import { erc20Abi, formatUnits, parseUnits, type PublicClient } from "viem";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";
import type { ConnectionType } from "@/lib/types/wallet";
import { useCompliance } from "@/hooks/useCompliance";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { finalizeAppTransactionBatch } from "@/lib/utils/tx";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { quoteSwapExactIn } from "@/lib/launchpad/uniswap";
import { AAVE_V4_RESERVES, AAVE_V4_SPOKE } from "@/lib/lending/aave-v4/constants";
import { borrowPower, MIN_HEALTH_FACTOR } from "@/lib/lending/aave-v4/math";
import {
  LEVERAGE_SLIPPAGE_BPS,
  MAX_BUY_PREMIUM_PCT,
  MAX_LOOPS,
  buildLeverageCalls,
  maxLeverageFor,
  planLeverage,
  premiumTooHigh,
} from "@/lib/lending/aave-v4/leverage";
import { simulateBatchAtomically } from "@/lib/lending/aave-v4/simulate";
import { useAaveV4 } from "./useAaveV4";

/** Only smart wallets can run the whole loop as one batch that either fully happens or not at all. */
const SMART_WALLETS: ConnectionType[] = ["baseAccount", "coinbase", "farcaster"];
const USDC = AAVE_V4_RESERVES.USDC.address as `0x${string}`;
const usd = (n: number, d = 2) => `$${n.toLocaleString(undefined, { maximumFractionDigits: d })}`;

type Quote = { buyPrice: number; avgPrice: number; feeTier: number } | { error: string } | null;

export default function AaveV4LeveragePanel({
  option,
  userAddress,
  connType,
  onBack,
  onClose,
  onRequestConnect,
  onSuccess,
}: {
  option: StockLendingOption;
  userAddress?: string | null;
  connType?: ConnectionType | null;
  onBack: () => void;
  onClose: () => void;
  onRequestConnect?: () => void;
  onSuccess?: () => void;
}) {
  const compliance = useCompliance();
  const v4 = useAaveV4(true, userAddress);
  const stock = v4.overview?.stocks.find((s) => s.address.toLowerCase() === option.stockAddress.toLowerCase());
  const reserve = Object.values(AAVE_V4_RESERVES).find((r) => r.address.toLowerCase() === option.stockAddress.toLowerCase());
  const isSmartWallet = !!connType && SMART_WALLETS.includes(connType);
  const restricted = !compliance.status.features["stocks.lend"] || (compliance.isRestricted && !compliance.canEnter);

  const [walletTokens, setWalletTokens] = useState(0);
  const [allowance, setAllowance] = useState(BigInt(0));
  const [startInput, setStartInput] = useState("");
  const [target, setTarget] = useState(1.5);
  const [quote, setQuote] = useState<Quote>(null);
  const [quoting, setQuoting] = useState(false);
  const [ack, setAck] = useState(false);
  const [step, setStep] = useState<"idle" | "checking" | "confirming" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Wallet balance and the existing allowance to the spoke
  useEffect(() => {
    if (!userAddress || !stock) return;
    let alive = true;
    const pub = createBasePublicClient() as unknown as PublicClient;
    void Promise.all([
      pub.readContract({ address: stock.address, abi: erc20Abi, functionName: "balanceOf", args: [userAddress as `0x${string}`] }),
      pub.readContract({ address: stock.address, abi: erc20Abi, functionName: "allowance", args: [userAddress as `0x${string}`, AAVE_V4_SPOKE] }),
    ])
      .then(([bal, allow]) => {
        if (!alive) return;
        setWalletTokens(Number(formatUnits(bal, stock.decimals)));
        setAllowance(allow);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userAddress, stock]);

  const startTokens = Math.max(0, parseFloat(startInput) || 0);
  const position = v4.position;
  const existing = useMemo(() => {
    const lines = (position?.collateral ?? []).map((c) => ({ usd: c.usd, collateralFactor: c.collateralFactor, on: c.collateralOn }));
    return { power: borrowPower(lines), debt: position?.debtUsdc ?? 0 };
  }, [position]);
  const thisCollateral = position?.collateral.find((c) => c.symbol === option.stockSymbol);

  const common = stock
    ? { priceUsd: stock.priceUsd, collateralFactor: stock.collateralFactor, startTokens, existingPower: existing.power, existingDebt: existing.debt }
    : null;
  const maxLev = common && startTokens > 0 ? Math.max(1, Math.floor(maxLeverageFor({ ...common, buyPriceUsd: common.priceUsd * 1.02 }) * 20) / 20) : 1;
  const effTarget = Math.min(target, maxLev);

  // Real quote for the whole amount, so the plan is priced on what the pool will actually charge
  const quoteSeq = useRef(0);
  useEffect(() => {
    if (!common || startTokens <= 0 || effTarget <= 1.0001) {
      setQuote(null);
      return;
    }
    const mine = ++quoteSeq.current;
    setQuoting(true);
    const handle = setTimeout(async () => {
      try {
        let price = common.priceUsd * 1.01;
        let last: { avg: number; feeTier: number } | null = null;
        for (let i = 0; i < 2; i++) {
          const p = planLeverage({ ...common, targetLeverage: effTarget, buyPriceUsd: price });
          if (p.totalBorrowUsd < 1) break;
          const q = await quoteSwapExactIn(USDC, reserve!.address as `0x${string}`, BigInt(Math.floor(p.totalBorrowUsd * 1e6)));
          if (!q.hasLiquidity) {
            if (quoteSeq.current === mine) setQuote({ error: `There is no Uniswap pool with enough depth to buy ${option.stockSymbol} with USDC.` });
            return;
          }
          const avg = p.totalBorrowUsd / (Number(q.amountOut) / 10 ** stock!.decimals);
          last = { avg, feeTier: q.feeTier };
          price = avg * (1 + LEVERAGE_SLIPPAGE_BPS / 10_000);
        }
        if (quoteSeq.current === mine) setQuote(last ? { buyPrice: price, avgPrice: last.avg, feeTier: last.feeTier } : null);
      } catch {
        if (quoteSeq.current === mine) setQuote({ error: "Could not get a price for this size right now. Try again." });
      } finally {
        if (quoteSeq.current === mine) setQuoting(false);
      }
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTokens, effTarget, stock?.priceUsd, existing.power, existing.debt]);

  const quoted = quote && "buyPrice" in quote ? quote : null;
  const plan = common && quoted ? planLeverage({ ...common, targetLeverage: effTarget, buyPriceUsd: quoted.buyPrice }) : null;
  const tooExpensive = !!(quoted && stock && premiumTooHigh(quoted.avgPrice, stock.priceUsd));
  const premiumPct = quoted && stock ? (quoted.avgPrice / stock.priceUsd - 1) * 100 : 0;
  const yearlyInterest = plan && v4.overview ? plan.debtUsd * (v4.overview.usdc.borrowApr / 100) : 0;
  const notEnoughStock = startTokens > walletTokens + 1e-9;
  const canRun = !!(plan && plan.steps.length > 0 && !tooExpensive && !notEnoughStock && ack && isSmartWallet && !restricted && stock && !stock.paused && !stock.frozen && v4.overview?.usdc.borrowable);

  const run = async () => {
    if (!userAddress) return onRequestConnect?.();
    if (!plan || !quoted || !stock || !reserve || !connType) return;
    setMessage(null);
    setStep("checking");
    try {
      const startRaw = parseUnits(startTokens.toFixed(stock.decimals), stock.decimals);
      const calls = finalizeAppTransactionBatch(
        buildLeverageCalls({
          user: userAddress as `0x${string}`,
          stock: { address: stock.address, reserveId: reserve.id },
          startRaw,
          startNeedsApproval: allowance < startRaw,
          collateralAlreadyOn: thisCollateral?.collateralOn ?? false,
          steps: plan.steps.map((s) => ({
            borrowRaw: parseUnits(s.borrowUsd.toFixed(6), 6),
            minOutRaw: BigInt(Math.floor(s.minTokens * 10 ** stock.decimals)),
          })),
          uniswapFee: quoted.feeTier,
        })
      );

      // The whole batch, in order, on live state, before the wallet is asked. Stops on any failure or a thin cushion.
      const sim = await simulateBatchAtomically(userAddress as `0x${string}`, calls);
      if (!sim.ok) {
        setStep("error");
        setMessage(sim.reason);
        return;
      }
      if (sim.healthFactor != null && sim.healthFactor < MIN_HEALTH_FACTOR + 0.2) {
        setStep("error");
        setMessage(`The on-chain check shows a health factor of ${sim.healthFactor.toFixed(2)}, too close to liquidation. Nothing was sent. Try a smaller target.`);
        return;
      }

      setStep("confirming");
      const hash = await sendAppTransactions(connType, userAddress, calls, { atomicBatch: true });
      setTxHash(hash);
      setStep("pending");
      const pub = createBasePublicClient() as unknown as PublicClient;
      const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status === "success") {
        setStep("success");
        void v4.refresh();
        onSuccess?.();
      } else {
        setStep("error");
        setMessage("The transaction was reverted on-chain, so nothing changed. Your funds are as they were.");
      }
    } catch (e) {
      setStep("error");
      setMessage(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  const busy = step === "checking" || step === "confirming" || step === "pending";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md h-auto max-h-[90dvh] sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] bg-[var(--surface-3)] border-t sm:border border-[var(--border-subtle)] shadow-2xl flex flex-col min-h-0 overflow-hidden rounded-t-3xl sm:rounded-3xl"
    >
      <div className="pulse-surface shrink-0 rounded-none p-5 pb-4 shadow-none">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
            <ArrowLeft size={14} /> Back
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]">
            <X size={18} />
          </button>
        </div>
        <p className="pulse-eyebrow mt-2 mb-1.5"><span className="pulse-status-dot" aria-hidden /> Aave V4 · Leverage</p>
        <h3 className="font-mono font-black text-xl text-[var(--ink)]">Leverage {option.stockSymbol}</h3>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">Borrow USDC against your stock, buy more of it, and repeat, in one confirmation.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-[var(--ink-muted)] leading-relaxed flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <span>
            <b className="text-[var(--ink)]">Leverage multiplies losses as well as gains.</b> If {option.stockSymbol} falls far enough your collateral is sold
            to repay the loan, and you can lose most or all of what you put in, quickly. The stock also trades 24/7 on-chain while the price Aave uses
            updates on weekdays, so gaps can happen. Not available in the US.
          </span>
        </div>

        {!isSmartWallet && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--ink-muted)]">
            Leverage runs as one batch that either fully happens or not at all. That needs a Base Account or Coinbase Smart Wallet. Your current wallet would
            ask for each step separately and could stop halfway, so it is turned off for it.
          </div>
        )}
        {restricted && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--ink-muted)]">Stock lending isn&apos;t available in your region.</div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="lev-start" className="font-bold text-[var(--ink)]">1. Start with</label>
            <span className="text-[var(--ink-muted)]">In wallet: <b className="font-mono text-[var(--ink)]">{walletTokens.toFixed(4)} {option.stockSymbol}</b></span>
          </div>
          <div className="relative">
            <input
              id="lev-start"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={startInput}
              onChange={(e) => { setStartInput(e.target.value); setAck(false); }}
              className="w-full pl-3.5 pr-24 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] font-mono text-lg font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--brand-text)]"
            />
            <button type="button" onClick={() => setStartInput(walletTokens > 0 ? walletTokens.toFixed(stock?.decimals ?? 8).replace(/\.?0+$/, "") : "")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-[11px] font-mono font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
              MAX
            </button>
          </div>
          {stock && startTokens > 0 && <p className="text-[11px] text-[var(--ink-muted)]">≈ {usd(startTokens * stock.priceUsd)} at {usd(stock.priceUsd)} per {option.stockSymbol}</p>}
          {notEnoughStock && <p className="text-[11px] text-red-500">You hold less than that.</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="lev-target" className="font-bold text-[var(--ink)]">2. Leverage</label>
            <b className="font-mono text-[var(--ink)]">{effTarget.toFixed(2)}x</b>
          </div>
          <input
            id="lev-target"
            type="range"
            min={1.1}
            max={Math.max(1.1, maxLev)}
            step={0.05}
            value={Math.min(target, Math.max(1.1, maxLev))}
            disabled={startTokens <= 0 || maxLev <= 1.1}
            onChange={(e) => { setTarget(parseFloat(e.target.value)); setAck(false); }}
            className="w-full accent-[var(--brand)]"
          />
          <p className="text-[11px] text-[var(--ink-muted)]">
            {startTokens > 0
              ? `Up to ${maxLev.toFixed(2)}x here, where your health factor stays at 1.5 or better. At most ${MAX_LOOPS} rounds.`
              : "Enter an amount to see how far you can go."}
          </p>
        </div>

        {quoting && <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]"><Loader2 size={14} className="animate-spin" /> Pricing the purchase on the live pool…</div>}
        {quote && "error" in quote && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">{quote.error}</div>}
        {tooExpensive && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
            Buying this much {option.stockSymbol} would cost {premiumPct.toFixed(1)}% more than its price (the limit is {MAX_BUY_PREMIUM_PCT}%). The pool is too thin for this size. Try a smaller amount or lower leverage.
          </div>
        )}

        {plan && quoted && plan.steps.length > 0 && !tooExpensive && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs space-y-1.5" aria-label="Plan preview">
            <Row k="You put in" v={usd(startTokens * (stock?.priceUsd ?? 0))} />
            <Row k="USDC borrowed" v={usd(plan.totalBorrowUsd)} />
            <Row k={`${option.stockSymbol} bought (at least)`} v={`${plan.minTokensBought.toFixed(4)}`} />
            <Row k="Position value" v={`${usd(plan.collateralUsd)} (${plan.leverageReached.toFixed(2)}x)`} />
            <Row k="Health factor after" v={plan.healthFactor != null ? plan.healthFactor.toFixed(2) : "—"} />
            <Row k={`${option.stockSymbol} liquidation price`} v={plan.liquidationPrice != null ? `${usd(plan.liquidationPrice)} (down ${plan.dropToLiquidationPct?.toFixed(0)}%)` : "—"} />
            <Row k="Cost of buying" v={`${usd(plan.buyCostUsd)} (${plan.buyPremiumPct.toFixed(2)}%)`} />
            <Row k="Borrow cost per year" v={`${usd(yearlyInterest)} at ${v4.overview?.usdc.borrowApr.toFixed(2)}%`} />
            <Row k="Rounds in one confirmation" v={`${plan.steps.length}`} />
            {plan.limitedBy !== "target" && (
              <p className="pt-1 text-[11px] text-amber-500">
                {plan.limitedBy === "safe-health" ? "Stopped where your health factor reaches 1.5." : `Stopped at the ${MAX_LOOPS}-round limit.`}
              </p>
            )}
            <p className="pt-1 text-[11px] text-[var(--ink-muted)] leading-snug">
              Numbers use the minimum each swap is guaranteed to return. The stock earns nothing here, so unless it rises you pay the borrow cost. Before your wallet opens, the whole batch is run on the live chain and cancelled if any step would fail.
            </p>
          </div>
        )}

        {plan && plan.steps.length > 0 && !tooExpensive && (
          <label className="flex items-start gap-2 text-xs text-[var(--ink-muted)] cursor-pointer">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-[var(--brand)]" />
            <span>
              I understand I can lose more than I put in, and that I could be liquidated if {option.stockSymbol} falls {plan.dropToLiquidationPct != null ? `about ${plan.dropToLiquidationPct.toFixed(0)}%` : "far enough"}.
            </span>
          </label>
        )}

        {message && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500 break-words">{message}</div>}
        {step === "success" && txHash && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-[var(--ink)]">
            Done. Your leveraged position is open.{" "}
            <a className="font-bold underline" href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer">View on BaseScan</a>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--surface-3)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={userAddress ? !canRun || busy : false}
          onClick={() => void run()}
          className="w-full py-3.5 px-4 rounded-xl bg-[var(--brand)] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {!userAddress
            ? "Connect wallet"
            : step === "checking"
              ? "Checking the plan on-chain…"
              : step === "confirming"
                ? "Confirm in your wallet…"
                : step === "pending"
                  ? "Waiting for Base…"
                  : step === "success"
                    ? "Done"
                    : "Open leveraged position"}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--ink-muted)]">{k}</span>
      <b className="font-mono text-[var(--ink)] text-right">{v}</b>
    </div>
  );
}
