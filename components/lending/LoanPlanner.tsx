"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import type { StockLendingComparison, StockLendingOption } from "@/lib/lending/unified-comparison";
import {
  DEFAULT_GAP_BUFFER_PCT,
  borrowCost,
  conservativeBorrowLimitUsd,
  currentLtvPct,
  healthFactor,
  liquidationPriceUsd,
  loanWarnings,
  maxSurvivableDropPct,
  protocolBorrowCeilingUsd,
  repayOptions,
  riskTier,
  runStress,
  runStressSuite,
  type LoanInputs,
  type RiskTier,
  type StressOutcome,
} from "@/lib/lending/loan-stress";

const usd = (n: number, d = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });

const TIER: Record<RiskTier, { label: string; cls: string }> = {
  none: { label: "No loan", cls: "text-[var(--ink-muted)]" },
  conservative: { label: "Conservative", cls: "text-emerald-500" },
  moderate: { label: "Moderate", cls: "text-amber-500" },
  aggressive: { label: "Aggressive", cls: "text-orange-500" },
  danger: { label: "Danger", cls: "text-red-500" },
};

const OUTCOME: Record<StressOutcome, { label: string; cls: string }> = {
  safe: { label: "Safe", cls: "text-emerald-500" },
  tight: { label: "Tight", cls: "text-amber-500" },
  liquidatable: { label: "Liquidated", cls: "text-red-500" },
  underwater: { label: "Underwater", cls: "text-red-500" },
};

function isBorrowable(o: StockLendingOption) {
  return o.borrowApr !== null && (o.liquidationThreshold ?? o.maxLtv) !== null;
}

/**
 * One-screen stock-backed loan planner: cost, conservative limit, liquidation price,
 * gap stress scenarios and repay options for the selected market.
 */
export default function LoanPlanner({
  comparison,
  marketOpen,
  walletBalanceUsd,
}: {
  comparison: StockLendingComparison;
  marketOpen: boolean;
  walletBalanceUsd: number | null;
}) {
  const options = useMemo(() => comparison.options.filter(isBorrowable), [comparison.options]);
  const [optionId, setOptionId] = useState<string>(
    () => (comparison.bestBorrowOption && isBorrowable(comparison.bestBorrowOption) ? comparison.bestBorrowOption.id : options[0]?.id) ?? ""
  );
  const [collateralInput, setCollateralInput] = useState<string>(() =>
    walletBalanceUsd && walletBalanceUsd > 0 ? walletBalanceUsd.toFixed(0) : "1000"
  );
  const [borrowPct, setBorrowPct] = useState(50); // % of the protocol ceiling
  const [customDrop, setCustomDrop] = useState(30);

  // Manual terms: used when no live borrow market exists for this stock, so the planner
  // never shows invented numbers — the user types the terms of the market they intend to use.
  const [manualLltv, setManualLltv] = useState("70");
  const [manualApr, setManualApr] = useState("");

  const option = options.find((o) => o.id === optionId) ?? options[0];
  const terms = useMemo(() => {
    if (option) {
      return {
        live: true,
        lltv: (option.liquidationThreshold ?? option.maxLtv) as number,
        apr: option.borrowApr,
        liquidityUsd: option.availableLiquidityUsd as number | undefined,
      };
    }
    const lltv = Math.min(95, Math.max(1, Number(manualLltv) || 0));
    const aprNum = manualApr.trim() === "" ? null : Number(manualApr);
    return {
      live: false,
      lltv,
      apr: aprNum !== null && Number.isFinite(aprNum) ? aprNum : null,
      liquidityUsd: undefined as number | undefined,
    };
  }, [option, manualLltv, manualApr]);

  const model = useMemo(() => {
    const collateralUsd = Math.max(0, Number(collateralInput) || 0);
    const lltv = terms.lltv;
    const ceiling = protocolBorrowCeilingUsd(collateralUsd, lltv);
    const safeLimit = conservativeBorrowLimitUsd(collateralUsd, lltv, DEFAULT_GAP_BUFFER_PCT);
    const debtUsd = (ceiling * borrowPct) / 100;
    const inputs: LoanInputs = {
      collateralUsd,
      debtUsd,
      liquidationLtvPct: lltv,
      priceUsd: comparison.navUsd,
      borrowAprPct: terms.apr,
    };
    return {
      inputs,
      ceiling,
      safeLimit,
      hf: healthFactor(collateralUsd, debtUsd, lltv),
      ltv: currentLtvPct(collateralUsd, debtUsd),
      liqPrice: liquidationPriceUsd(inputs),
      survivable: maxSurvivableDropPct(inputs),
      cost: borrowCost(debtUsd, terms.apr),
      tier: riskTier(inputs),
      suite: runStressSuite(inputs),
      custom: runStress(inputs, customDrop),
      repay: repayOptions(inputs),
      warnings: loanWarnings(inputs, {
        marketOpen,
        rateIsEstimate: true,
        availableLiquidityUsd: terms.liquidityUsd,
      }),
      overSafeLimit: debtUsd > safeLimit + 0.005,
    };
  }, [terms, collateralInput, borrowPct, customDrop, comparison.navUsd, marketOpen]);

  if (!(comparison.navUsd > 0)) return null;

  const safePct = model.ceiling > 0 ? Math.min(100, (model.safeLimit / model.ceiling) * 100) : 0;
  const tier = TIER[model.tier];

  return (
    <section
      aria-label="Stock-backed loan planner"
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-black text-[var(--ink)]">Borrow against {comparison.stockSymbol}</h2>
          <p className="text-xs text-[var(--ink-muted)]">
            Plan the loan, see what a price gap does to it, and know your way out — before you borrow.
          </p>
        </div>
        <span className={`text-xs font-black uppercase tracking-wide ${tier.cls}`}>Risk: {tier.label}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Controls */}
        <div className="space-y-4">
          {option ? (
            <div>
              <label htmlFor="lp-market" className="section-eyebrow mb-1.5 block">Market</label>
              <select
                id="lp-market"
                value={option.id}
                onChange={(e) => setOptionId(e.target.value)}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--ink)]"
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.protocolName} · borrow {o.borrowApr?.toFixed(2)}% · liq. LTV {(o.liquidationThreshold ?? o.maxLtv)?.toFixed(0)}%
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-500">
                No live borrow market for {comparison.stockSymbol} was found right now. Enter the terms of the market you
                plan to use (from the protocol&apos;s own page) to plan safely. Nothing here is a live quote.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lp-lltv" className="section-eyebrow mb-1.5 block">Liquidation LTV %</label>
                  <input
                    id="lp-lltv"
                    inputMode="decimal"
                    value={manualLltv}
                    onChange={(e) => setManualLltv(e.target.value.replace(/[^\d.]/g, ""))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 font-mono text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label htmlFor="lp-apr" className="section-eyebrow mb-1.5 block">Borrow APR %</label>
                  <input
                    id="lp-apr"
                    inputMode="decimal"
                    placeholder="unknown"
                    value={manualApr}
                    onChange={(e) => setManualApr(e.target.value.replace(/[^\d.]/g, ""))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 font-mono text-[var(--ink)]"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="lp-collateral" className="section-eyebrow mb-1.5 block">Collateral value (USD)</label>
            <input
              id="lp-collateral"
              inputMode="decimal"
              value={collateralInput}
              onChange={(e) => setCollateralInput(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 font-mono text-[var(--ink)]"
            />
            <p className="text-[11px] text-[var(--ink-dim)] mt-1">
              ≈ {(model.inputs.collateralUsd / comparison.navUsd || 0).toFixed(3)} {comparison.stockSymbol} at ${comparison.navUsd.toFixed(2)}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <label htmlFor="lp-borrow" className="section-eyebrow">Borrow (USDC)</label>
              <span className="font-mono font-black text-[var(--ink)]">{usd(model.inputs.debtUsd)}</span>
            </div>
            <div className="relative mt-2">
              <input
                id="lp-borrow"
                type="range"
                min={0}
                max={100}
                step={1}
                value={borrowPct}
                onChange={(e) => setBorrowPct(Number(e.target.value))}
                className="w-full"
                aria-valuetext={`${usd(model.inputs.debtUsd)} borrowed`}
              />
              {/* conservative-limit marker */}
              <div
                className="absolute top-0 h-4 w-0.5 bg-emerald-500 pointer-events-none"
                style={{ left: `${safePct}%` }}
                aria-hidden
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--ink-dim)] mt-1">
              <span>$0</span>
              <span className="text-emerald-500 font-bold">Conservative limit {usd(model.safeLimit)}</span>
              <span>Protocol max {usd(model.ceiling)}</span>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setBorrowPct(Math.round(safePct))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/40 text-emerald-500"
              >
                Set to conservative limit
              </button>
            </div>
            {model.overSafeLimit && (
              <p className="text-xs text-amber-500 mt-2">
                Above the conservative limit: a {DEFAULT_GAP_BUFFER_PCT}% overnight gap would liquidate this loan.
              </p>
            )}
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3 content-start">
          <Stat label="Health factor" value={model.hf === null ? "—" : model.hf.toFixed(2)} tone={model.hf !== null && model.hf < 1.25 ? "warn" : undefined} />
          <Stat label="Current LTV" value={`${model.ltv.toFixed(1)}%`} sub={`liquidates at ${terms.lltv}%`} />
          <Stat
            label="Liquidation price"
            value={model.liqPrice === null ? "—" : `$${model.liqPrice.toFixed(2)}`}
            sub={model.liqPrice === null ? "" : `${comparison.stockSymbol} now $${comparison.navUsd.toFixed(2)}`}
          />
          <Stat label="Can fall before liquidation" value={`${model.survivable.toFixed(1)}%`} />
          <Stat
            label="Interest cost"
            value={model.cost.unknown ? "Unknown" : `${usd(model.cost.perMonthUsd, 2)}/mo`}
            sub={model.cost.unknown ? "rate unavailable" : `${usd(model.cost.perYearUsd, 2)}/yr at ${terms.apr?.toFixed(2)}% (variable)`}
          />
          <Stat
            label="Pool liquidity"
            value={terms.liquidityUsd !== undefined ? usd(terms.liquidityUsd) : "—"}
            sub={terms.live ? "available to borrow" : "check in your protocol"}
          />
        </div>
      </div>

      {/* Stress table */}
      <div>
        <h3 className="text-sm font-black text-[var(--ink)] mb-2">If the price gaps down</h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--ink-muted)]">
              <tr>
                <th className="text-left p-2.5 font-bold">Scenario</th>
                <th className="text-right p-2.5 font-bold">Price</th>
                <th className="text-right p-2.5 font-bold">HF</th>
                <th className="text-right p-2.5 font-bold">Result</th>
                <th className="text-right p-2.5 font-bold">Repay to recover</th>
              </tr>
            </thead>
            <tbody>
              {[...model.suite, model.custom].map((s, idx, arr) => (
                <tr key={s.id} className="border-t border-[var(--border-subtle)]">
                  <td className="p-2.5">
                    {idx === arr.length - 1 ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-bold text-[var(--ink)]">Custom −{customDrop}%</span>
                        <input
                          type="range"
                          min={1}
                          max={90}
                          value={customDrop}
                          onChange={(e) => setCustomDrop(Number(e.target.value))}
                          aria-label="Custom price drop percent"
                          className="w-24"
                        />
                      </span>
                    ) : (
                      <>
                        <span className="font-bold text-[var(--ink)]">{s.label} −{s.dropPct}%</span>
                        <span className="block text-[10px] text-[var(--ink-dim)]">{s.description}</span>
                      </>
                    )}
                  </td>
                  <td className="p-2.5 text-right font-mono">${s.priceUsd.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-mono">{s.healthFactor === null ? "—" : s.healthFactor.toFixed(2)}</td>
                  <td className={`p-2.5 text-right font-black ${OUTCOME[s.outcome].cls}`}>
                    {model.inputs.debtUsd <= 0 ? "—" : OUTCOME[s.outcome].label}
                    {s.shortfallUsd > 0 && <span className="block text-[10px] font-normal">{usd(s.shortfallUsd)} shortfall</span>}
                    {s.penaltyLossUsd > 0 && s.shortfallUsd === 0 && (
                      <span className="block text-[10px] font-normal">≈{usd(s.penaltyLossUsd)} penalty</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right font-mono">{s.repayToRecoverUsd > 0 ? usd(s.repayToRecoverUsd) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--ink-dim)] mt-1.5">
          Model estimates using a {DEFAULT_GAP_BUFFER_PCT}% safety buffer and ~5% liquidation penalty. Real liquidation terms differ by protocol and price feed.
        </p>
      </div>

      {/* Repay options */}
      {model.repay.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-[var(--ink)] mb-2">Ways to reduce risk</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {model.repay.map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{r.label}</p>
                <p className="font-mono font-black text-[var(--ink)] mt-0.5">{usd(r.repayUsd)}</p>
                <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
                  {r.resultingHealthFactor !== null ? `HF → ${r.resultingHealthFactor.toFixed(2)}. ` : ""}
                  {r.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      <ul className="space-y-2">
        {model.warnings.map((w) => {
          const Icon = w.severity === "critical" ? ShieldAlert : w.severity === "warn" ? AlertTriangle : w.id === "debt" ? ShieldCheck : Info;
          const cls =
            w.severity === "critical"
              ? "border-red-500/30 bg-red-500/8 text-red-400"
              : w.severity === "warn"
                ? "border-amber-500/30 bg-amber-500/8 text-amber-500"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)]";
          return (
            <li key={w.id} className={`flex gap-2 rounded-xl border p-2.5 text-xs ${cls}`}>
              <Icon size={14} className="shrink-0 mt-0.5" />
              <span>{w.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{label}</p>
      <p className={`text-lg font-black font-mono mt-0.5 ${tone === "warn" ? "text-amber-500" : "text-[var(--ink)]"}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">{sub}</p>}
    </div>
  );
}
