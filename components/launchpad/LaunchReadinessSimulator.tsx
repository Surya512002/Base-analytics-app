"use client";

import React, { useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Coins,
  Bot,
  PieChart,
  Sparkles,
} from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import {
  computeLaunchReadiness,
  type LaunchSimulatorParams,
} from "@/lib/launchpad/readiness-simulator";

interface LaunchReadinessSimulatorProps {
  params: LaunchSimulatorParams;
  className?: string;
}

export default function LaunchReadinessSimulator({
  params,
  className = "",
}: LaunchReadinessSimulatorProps) {
  const report = useMemo(() => computeLaunchReadiness(params), [params]);

  // Feature flag check
  if (!FEATURES.LAUNCH_SIMULATOR) {
    return null;
  }

  const isOptimal = report.score >= 85;
  const isGood = report.score >= 65 && report.score < 85;

  return (
    <div
      data-testid="launch-readiness-simulator"
      className={`rounded-2xl border transition-all ${
        isOptimal
          ? "border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-[var(--surface-2)] to-emerald-950/20"
          : isGood
            ? "border-amber-500/30 bg-gradient-to-r from-amber-950/15 via-[var(--surface-2)] to-amber-950/15"
            : "border-rose-500/30 bg-gradient-to-r from-rose-950/20 via-[var(--surface-2)] to-rose-950/20"
      } p-4 sm:p-5 space-y-4 text-xs ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isOptimal
                ? "bg-emerald-500/15 text-emerald-500"
                : isGood
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-rose-500/15 text-rose-500"
            }`}
          >
            {isOptimal ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-[var(--ink)]">Pre-Flight Launch Score</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isOptimal
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : isGood
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                }`}
              >
                Grade {report.grade} · {report.tierLabel}
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">{report.summary}</p>
          </div>
        </div>

        {/* Score Meter */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-2xl font-mono font-black text-[var(--ink)]">{report.score}</span>
            <span className="text-xs font-mono text-[var(--ink-muted)]">/100</span>
          </div>
        </div>
      </div>

      {/* 4 Pillars Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {report.checks.map((check, idx) => {
          const Icon =
            idx === 0 ? Coins : idx === 1 ? Lock : idx === 2 ? Bot : PieChart;
          return (
            <div
              key={check.name}
              className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-start gap-2.5"
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  check.passed
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                <Icon size={14} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-[11px] text-[var(--ink)] truncate">
                    {check.name}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[var(--ink-muted)]">
                    {check.score}/{check.maxScore}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--ink-muted)] mt-0.5 leading-tight">
                  {check.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations if any */}
      {report.recommendations.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-[11px]">
            <Sparkles size={12} className="text-amber-600 dark:text-amber-400" />
            Recommendations to Maximize Fair Launch Trust:
          </span>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
            {report.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
