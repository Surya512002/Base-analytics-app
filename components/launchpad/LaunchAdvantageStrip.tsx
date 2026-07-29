"use client";

import { Sparkles, Zap } from "lucide-react";
import { LAUNCHPAD_ADVANTAGES } from "@/lib/launchpad/advantages";
import { BUILDER_CODE } from "@/lib/constants/env";

export default function LaunchAdvantageStrip() {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--brand)]" />
          <p className="text-sm font-bold text-[var(--ink)]">Why launch on Base Analytics</p>
        </div>
        <p className="font-mono text-[10px] text-[var(--ink-dim)]">
          Builder <span className="text-[var(--ink-muted)]">{BUILDER_CODE}</span> on launches &amp; swaps
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {LAUNCHPAD_ADVANTAGES.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink)]">
              <Zap size={11} className="shrink-0 text-emerald-600" />
              {item.title}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--ink-muted)]">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
