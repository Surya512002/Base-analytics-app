"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, ShieldAlert, Sparkles, X } from "lucide-react";
import type { TokenXRayReport } from "@/lib/launchpad/token-xray";
import { computeTokenXRayScore } from "@/lib/launchpad/token-xray";

interface TokenXRayBadgeProps {
  address: string;
  symbol?: string;
  liquidityUsd?: number;
  isVerified?: boolean;
  className?: string;
  compact?: boolean;
}

export default function TokenXRayBadge({
  address,
  symbol,
  liquidityUsd,
  isVerified,
  className = "",
  compact = false,
}: TokenXRayBadgeProps) {
  const [report, setReport] = useState<TokenXRayReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const fallback = computeTokenXRayScore({
      address,
      symbol,
      liquidityUsd: liquidityUsd ?? 25_000,
      isVerified,
    });
    setReport(fallback);

    fetch(`/api/launchpad/xray?token=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TokenXRayReport | null) => {
        if (!alive || !data) return;
        setReport(data);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [address, symbol, liquidityUsd, isVerified]);

  if (!report) return null;

  const isLowRisk = report.tier === "low_risk";
  const isModerate = report.tier === "moderate_risk";

  const colorClass = isLowRisk
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : isModerate
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";

  const Icon = isLowRisk ? ShieldCheck : isModerate ? AlertTriangle : ShieldAlert;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        title={`Token X-Ray Safety Score: ${report.score}/100 (${report.tierLabel}). Click for report.`}
        className={`pop-pill inline-flex items-center gap-1 font-mono font-bold rounded-lg border transition-all cursor-pointer ${colorClass} ${
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
        } ${className}`}
      >
        <Icon size={compact ? 11 : 13} className="shrink-0" />
        <span>{report.score}/100</span>
        {!compact && <span className="font-sans font-semibold text-[10px] opacity-80">{report.tierLabel}</span>}
      </button>

      {/* Safety X-Ray Detail Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${colorClass}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-1.5">
                    <span>Token X-Ray</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] font-mono">
                      {report.score}/100
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--ink-muted)]">{symbol ?? "Token"} Safety Audit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--ink-muted)] transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Score Summary */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs text-[var(--ink)] leading-relaxed">
              {report.summary}
            </div>

            {/* Factor Breakdown */}
            <div className="space-y-2 text-xs">
              <p className="font-bold text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">Audit Factors</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                  <span className="text-[10px] text-[var(--ink-muted)] block">LP &amp; Reserves</span>
                  <span className="font-bold text-xs text-[var(--ink)]">{report.factors.lpLockScore}/25 pts</span>
                  <p className="text-[10px] text-[var(--ink-dim)] truncate mt-0.5">{report.factors.lpLockStatus}</p>
                </div>
                <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                  <span className="text-[10px] text-[var(--ink-muted)] block">Concentration</span>
                  <span className="font-bold text-xs text-[var(--ink)]">{report.factors.concentrationScore}/25 pts</span>
                  <p className="text-[10px] text-[var(--ink-dim)] truncate mt-0.5">Top 10: {report.factors.top10ConcentrationPct.toFixed(1)}%</p>
                </div>
                <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                  <span className="text-[10px] text-[var(--ink-muted)] block">Ownership Privileges</span>
                  <span className="font-bold text-xs text-[var(--ink)]">{report.factors.privilegeScore}/25 pts</span>
                  <p className="text-[10px] text-[var(--ink-dim)] truncate mt-0.5">{report.factors.privilegeStatus}</p>
                </div>
                <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                  <span className="text-[10px] text-[var(--ink-muted)] block">Sell Simulation</span>
                  <span className="font-bold text-xs text-[var(--ink)]">{report.factors.honeypotScore}/25 pts</span>
                  <p className="text-[10px] text-[var(--ink-dim)] truncate mt-0.5">{report.factors.honeypotStatus}</p>
                </div>
              </div>
            </div>

            {/* Reasons / Strengths */}
            {report.reasons.length > 0 && (
              <div className="space-y-1">
                <p className="font-bold text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Verified Protections
                </p>
                <ul className="text-xs space-y-1 text-[var(--ink-muted)]">
                  {report.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Sparkles size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {report.warnings.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
                <p className="font-bold text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Risk Factors
                </p>
                <ul className="text-xs space-y-1 text-amber-600 dark:text-amber-400">
                  {report.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#0052FF] text-white font-bold text-xs hover:bg-[#0047e0] transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
