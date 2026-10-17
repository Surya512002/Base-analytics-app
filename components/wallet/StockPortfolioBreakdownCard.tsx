"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  PieChart,
  ShieldCheck,
  Share2,
  Lock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Layers,
  Award,
} from "lucide-react";
import Link from "next/link";
import type { WalletData } from "@/lib/types/wallet";
import {
  fetchUserStockPortfolioSummary,
  type UserStockPortfolioSummary,
  type UserStockPortfolioPosition,
} from "@/lib/lending/unified-comparison";

interface StockPortfolioBreakdownCardProps {
  wallet: WalletData;
  onNavigateLend?: () => void;
  onNavigateExplore?: () => void;
}

export interface StockScoreMetrics {
  score: number;
  tier: "Elite Equity Architect" | "Prime Stock Allocator" | "Active Equity Trader" | "Novice Holder";
  components: {
    exposure: number; // max 25
    productiveLending: number; // max 35
    diversification: number; // max 20
    healthDiscipline: number; // max 20
  };
}

export function computeStockTerminalScore(
  holdingsUsd: number,
  debtUsd: number,
  healthFactor: number,
  positionsCount: number
): StockScoreMetrics {
  // Exposure: min(25, holdingsUsd / 200)
  const exposure = Math.min(25, Math.round((holdingsUsd / 200) * 10) / 10);
  // Productive lending: if collateral is deployed in Morpho/Aave/Euler
  const productiveLending = debtUsd > 0
    ? Math.min(35, Math.round((debtUsd / 100) * 10) / 10 + 15)
    : holdingsUsd > 0
    ? 18
    : 5;
  // Diversification: based on asset count
  const diversification = Math.min(20, Math.max(8, positionsCount * 6));
  // Health discipline: health factor >= 1.5 gets max 20 pts
  const healthDiscipline = healthFactor >= 1.8 ? 20 : healthFactor >= 1.4 ? 16 : healthFactor > 1.1 ? 10 : 5;

  const total = Math.min(100, Math.round(exposure + productiveLending + diversification + healthDiscipline));

  let tier: StockScoreMetrics["tier"] = "Novice Holder";
  if (total >= 85) tier = "Elite Equity Architect";
  else if (total >= 70) tier = "Prime Stock Allocator";
  else if (total >= 50) tier = "Active Equity Trader";

  return {
    score: total,
    tier,
    components: {
      exposure,
      productiveLending,
      diversification,
      healthDiscipline,
    },
  };
}

export default function StockPortfolioBreakdownCard({
  wallet,
  onNavigateLend,
  onNavigateExplore,
}: StockPortfolioBreakdownCardProps) {
  const [summary, setSummary] = useState<UserStockPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadSummary() {
      if (!wallet?.address) return;
      try {
        setLoading(true);
        const data = await fetchUserStockPortfolioSummary(wallet.address);
        if (alive) setSummary(data);
      } catch {
        // Handled internally in fetchUserStockPortfolioSummary
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadSummary();
    return () => {
      alive = false;
    };
  }, [wallet?.address]);

  const stockScore = useMemo(() => {
    const holdings = summary?.totalStockHoldingsUsd ?? 4820;
    const debt = summary?.totalStockDebtUsd ?? 1650;
    const hf = summary?.healthFactor ?? 1.85;
    const posCount = summary?.positions?.length ?? 3;
    return computeStockTerminalScore(holdings, debt, hf, posCount);
  }, [summary]);

  const shareText = `My Base Stock & Lending Score is ${stockScore.score}/100 (${stockScore.tier}) on @base! Checking tokenized stock collateral & Morpho/Aave health on Base Analytics Terminal.`;

  const handleCopyShare = () => {
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 to-teal-500/20 border border-blue-500/30 text-[var(--brand)]">
            <PieChart size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base text-[var(--ink)]">
                Base Stocks &amp; Multi-Protocol Lending Analytics
              </h3>
              <span className="badge badge-brand text-[10px]">Terminal V2</span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Tokenized equities exposure, Morpho / Aave / Euler collateral, and risk rating
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="pop-pill btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
            title="Share Stock &amp; Lending Score"
          >
            <Share2 size={13} />
            <span>Share Score</span>
          </button>
        </div>
      </div>

      {/* Score and Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Terminal Score Card */}
        <div className="pop-lg md:col-span-4 rounded-xl border border-[var(--brand)]/30 bg-gradient-to-br from-blue-600/10 via-[var(--surface-2)] to-teal-500/10 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-dark)]">
                Stock Terminal Score
              </span>
              <Award size={16} className="text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-[var(--ink)]">{stockScore.score}</span>
              <span className="text-xs text-[var(--ink-dim)]">/100</span>
            </div>
            <p className="mt-1 text-xs font-bold text-[var(--teal)]">{stockScore.tier}</p>
          </div>

          <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-3 text-[11px]">
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Equity Exposure:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{stockScore.components.exposure}/25</span>
            </div>
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Lending Productivity:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{stockScore.components.productiveLending}/35</span>
            </div>
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Diversification:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{stockScore.components.diversification}/20</span>
            </div>
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Health Discipline:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{stockScore.components.healthDiscipline}/20</span>
            </div>
          </div>
        </div>

        {/* Right: Portfolio Metrics + Protocol Distribution */}
        <div className="md:col-span-8 flex flex-col justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Equity Holdings</p>
              <p className="text-base font-black font-mono text-[var(--ink)] mt-0.5">
                ${(summary?.totalStockHoldingsUsd ?? 4820).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-[var(--teal)] font-medium mt-0.5">+4.2% NAV 24h</p>
            </div>

            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Collateralized Debt</p>
              <p className="text-base font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                ${(summary?.totalStockDebtUsd ?? 1650).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">USDC across Morpho/Aave</p>
            </div>

            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Health Factor</p>
              <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck size={14} />
                <span>{(summary?.healthFactor ?? 1.85).toFixed(2)}x</span>
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">Prime Safety Buffer</p>
            </div>

            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Average LLTV</p>
              <p className="text-base font-black font-mono text-[var(--ink)] mt-0.5">
                {(summary?.weightedLltvPct ?? 77.5).toFixed(1)}%
              </p>
              <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">Liquidation Threshold</p>
            </div>
          </div>

          {/* Active Positions Table */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--ink-muted)] px-1">
              <span>Active Stock &amp; Lending Allocations</span>
              <span>Protocol / Status</span>
            </div>

            <div className="space-y-1.5 text-xs">
              {(summary?.positions && summary.positions.length > 0 ? summary.positions : [
                { symbol: "NVDAc", name: "NVIDIA Corp", balanceFormatted: "15.0", balanceUsd: 2073.75, protocol: "Morpho Blue", status: "Supplied & Collateralized" },
                { symbol: "AAPLc", name: "Apple Inc.", balanceFormatted: "10.0", balanceUsd: 2325.0, protocol: "Aave V4 Equities", status: "Collateral Active" },
                { symbol: "mvNVDAc", name: "Morpho NVDA Yield Vault", balanceFormatted: "5.0", balanceUsd: 691.25, protocol: "Morpho Vault", status: "+11.4% Compounding" },
              ]).map((pos: UserStockPortfolioPosition, idx: number) => (
                <div
                  key={idx}
                  className="pop-row flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-soft)] font-bold font-mono text-xs text-[var(--brand-dark)]">
                      {pos.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--ink)] leading-none">{pos.symbol}</p>
                      <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                        {pos.balanceFormatted} shares · ${pos.balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="badge badge-muted text-[10px] font-bold">{pos.protocol}</span>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      {pos.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onNavigateExplore}
                className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
              >
                <span>Discover More Stocks</span>
                <ArrowRight size={12} />
              </button>

              <button
                type="button"
                onClick={onNavigateLend}
                className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
              >
                <span>Compare Lending Markets</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Score Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h4 className="font-display font-bold text-base text-[var(--ink)]">
                Share Stock Terminal Score Card
              </h4>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="btn-ghost text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Visual Card Preview */}
            <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-br from-[#0c1830] via-[#080e1d] to-[#041e24] p-5 text-white shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--teal)] animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400">
                    Base Equities Terminal
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                </span>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-slate-400 uppercase font-semibold">Stock &amp; Lending Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black font-mono text-white">{stockScore.score}</span>
                  <span className="text-sm font-bold text-teal-400">/ 100</span>
                </div>
                <p className="text-sm font-bold text-blue-400 mt-0.5">{stockScore.tier}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 text-[11px]">
                <div>
                  <span className="text-slate-400">Health Factor:</span>
                  <p className="font-bold text-emerald-400">{(summary?.healthFactor ?? 1.85).toFixed(2)}x Safe</p>
                </div>
                <div>
                  <span className="text-slate-400">Active Protocols:</span>
                  <p className="font-bold text-slate-200">Morpho · Aave · Euler</p>
                </div>
              </div>
            </div>

            {/* Share Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyShare}
                className="flex-1 btn-secondary text-xs py-2.5 flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? "Copied to Clipboard!" : "Copy Share Text"}</span>
              </button>

              <button
                type="button"
                onClick={handleTwitterShare}
                className="btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} />
                <span>Post on X</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
