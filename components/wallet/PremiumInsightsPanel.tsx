"use client";

import { useState } from "react";
import { CheckCircle, Copy, Download, Sparkles, TrendingUp } from "lucide-react";
import type { PremiumInsights } from "@/lib/premium/build-insights";

interface PremiumInsightsPanelProps {
  insights: PremiumInsights | null;
  unlocked: boolean;
}

export default function PremiumInsightsPanel({ insights, unlocked }: PremiumInsightsPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!unlocked) {
    return (
      <div className="elegant-panel rounded-3xl p-5 border border-amber-500/15">
        <p className="section-eyebrow text-amber-300">x402 Premium</p>
        <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
          Pay with USDC to unlock deep benchmarks —{" "}
          <span className="text-amber-300 font-bold">Deep Scan $0.01</span>
          {" · "}
          <span className="text-amber-300 font-bold">Export $0.05</span>
          {" · "}
          <span className="text-amber-300 font-bold">Compare Pro $0.10</span>
        </p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="elegant-panel rounded-3xl p-5 border border-emerald-500/20 animate-pulse">
        <p className="text-sm text-[var(--ink-muted)]">Loading premium insights…</p>
      </div>
    );
  }

  const downloadExport = () => {
    if (!insights.exportSummary) return;
    const blob = new Blob([insights.exportSummary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-analytics-${insights.address.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyExport = () => {
    if (!insights.exportSummary) return;
    navigator.clipboard.writeText(insights.exportSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="elegant-panel rounded-3xl overflow-hidden border border-amber-500/25 card-shimmer">
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-eyebrow text-amber-300 flex items-center gap-2">
              <Sparkles size={12} /> Premium unlocked
            </p>
            <h3 className="text-lg font-black text-[var(--ink)] mt-1">{insights.headline}</h3>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full shrink-0">
            {insights.tier}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-4">
            <p className="text-[9px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-3 flex items-center gap-1">
              <TrendingUp size={11} /> Benchmarks
            </p>
            <div className="space-y-2">
              {insights.benchmarks.map((b) => (
                <div key={b.label} className="flex justify-between gap-2 text-xs">
                  <span className="text-[var(--ink-muted)]">{b.label}</span>
                  <span className="font-bold text-[var(--ink)] text-right">
                    {b.value}
                    <span className="block text-[9px] text-[var(--ink-muted)] font-medium">{b.vsMedian}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-4">
            <p className="text-[9px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-3">Portfolio</p>
            <div className="space-y-2">
              {insights.portfolio.map((p) => (
                <div key={p.label} className="flex justify-between gap-2 text-xs">
                  <span className="text-[var(--ink-muted)]">{p.label}</span>
                  <span className="font-bold text-[var(--ink)]">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          {insights.highlights.map((h, i) => (
            <li key={i} className="flex gap-2 text-xs text-[var(--ink-soft)] leading-relaxed">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              {h}
            </li>
          ))}
        </ul>

        {insights.exportSummary && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-xs font-black"
            >
              <Download size={14} /> Download report
            </button>
            <button
              type="button"
              onClick={copyExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs font-black"
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy summary"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
