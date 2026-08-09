"use client";

import { motion, AnimatePresence } from "motion/react";
import { BarChart3, Blocks, Flame, LineChart, Sparkles, Wallet } from "lucide-react";

const SYNC_STAGES = [
  { id: "history", label: "History", icon: Blocks },
  { id: "score", label: "Score", icon: LineChart },
  { id: "heatmap", label: "Heatmap", icon: Flame },
  { id: "swaps", label: "Swaps", icon: Wallet },
] as const;

function stageIndex(progress?: string): number {
  if (!progress) return 0;
  const p = progress.toLowerCase();
  if (p.includes("complete") || p.includes("up to date")) return 4;
  if (p.includes("swap") || p.includes("volume") || p.includes("health")) return 3;
  if (
    p.includes("heatmap") ||
    p.includes("history") ||
    p.includes("active days") ||
    p.includes("syncing") ||
    p.includes("payment")
  )
    return 2;
  if (p.includes("score") || p.includes("calculating") || p.includes("alchemy")) return 1;
  return 1;
}

function stageCurrent(i: number, activeStage: number): boolean {
  if (activeStage <= 0) return i === 0;
  if (activeStage >= SYNC_STAGES.length) return false;
  return i === Math.min(activeStage, SYNC_STAGES.length - 1) && i >= activeStage - 1
    ? i === Math.min(activeStage, SYNC_STAGES.length - 1)
    : i === activeStage;
}

/** Full-size post-pay overlay — blurs score / heatmap while Alchemy history builds. */
export default function AnalyticsLoadingPanel({
  scanProgress,
  walletRefreshing,
  variant = "hero",
}: {
  scanProgress?: string;
  walletRefreshing?: boolean;
  /** hero = standalone full panel; overlay = absolute cover over blurred analytics */
  variant?: "hero" | "overlay";
}) {
  const activeStage = stageIndex(scanProgress);
  const pct = Math.min(96, Math.max(14, 10 + activeStage * 22));

  const body = (
    <div className="relative w-full max-w-lg mx-auto text-center px-4 py-8 sm:py-10">
      {/* Crypto motion field */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl" aria-hidden>
        {[
          { size: 96, x: "8%", y: "12%", color: "rgba(37,99,235,0.18)", delay: 0 },
          { size: 64, x: "72%", y: "18%", color: "rgba(16,185,129,0.16)", delay: 0.4 },
          { size: 80, x: "58%", y: "62%", color: "rgba(245,158,11,0.14)", delay: 0.8 },
          { size: 52, x: "18%", y: "68%", color: "rgba(99,102,241,0.16)", delay: 1.1 },
        ].map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-2xl"
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              background: orb.color,
            }}
            animate={{
              y: [0, -14, 6, 0],
              x: [0, 8, -6, 0],
              scale: [1, 1.12, 0.96, 1],
              opacity: [0.55, 0.9, 0.65, 0.55],
            }}
            transition={{
              duration: 4.2 + i * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: orb.delay,
            }}
          />
        ))}
        {/* Floating chain dots */}
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={`dot-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-[var(--brand)]/40"
            style={{
              left: `${12 + ((i * 11) % 76)}%`,
              top: `${20 + ((i * 17) % 58)}%`,
            }}
            animate={{
              y: [0, -18 - (i % 3) * 6, 0],
              opacity: [0.2, 0.85, 0.2],
            }}
            transition={{
              duration: 2.4 + (i % 4) * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.18,
            }}
          />
        ))}
      </div>

      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div
          className="relative w-20 h-20 mx-auto mb-5"
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-[var(--brand)]/45" />
          <motion.div
            className="absolute inset-2 rounded-xl bg-gradient-to-br from-[#dbeafe] via-[var(--surface)] to-[#d1fae5] border border-[var(--border-subtle)] flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.12)]"
            animate={{ rotate: -360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          >
            {walletRefreshing ? (
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <BarChart3 size={28} className="text-[var(--brand-dark)]" />
              </motion.div>
            ) : (
              <Sparkles size={28} className="text-[var(--brand-dark)]" />
            )}
          </motion.div>
        </motion.div>

        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-dark)] mb-2">
          Onchain analysis in progress
        </p>
        <h2 className="text-2xl sm:text-3xl font-black text-[var(--ink)] tracking-tight">
          Building your full Base report
        </h2>
        <p className="text-sm text-[var(--ink-muted)] max-w-md mx-auto leading-relaxed mt-2">
          After unlock we deep-index Alchemy history, AA / Base App user-ops, score, and heatmap.
          This overlay stays until the first complete analysis pass finishes.
        </p>

        <AnimatePresence mode="wait">
          <motion.p
            key={scanProgress || "default"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-4 text-[11px] font-bold text-[var(--ink)] uppercase tracking-wide"
          >
            {scanProgress || "Indexing onchain activity…"}
          </motion.p>
        </AnimatePresence>

        <div className="mt-5 max-w-md mx-auto">
          <div className="h-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--border-subtle)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#2563eb] via-[#0d9488] to-[#059669]"
              initial={{ width: "12%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <p className="mt-2 text-[11px] text-[var(--ink-muted)] font-mono tabular-nums">
            {pct}% · live scan
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto">
          {SYNC_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const done = i < activeStage;
            const current = !done && stageCurrent(i, activeStage);
            return (
              <motion.div
                key={stage.id}
                className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
                  done
                    ? "bg-emerald-50 border-emerald-300/70 text-emerald-700"
                    : current
                      ? "bg-sky-50 border-sky-300 text-sky-800 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
                      : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)]"
                }`}
                animate={current ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Icon size={14} />
                {stage.label}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-[var(--surface)]/72 backdrop-blur-md" />
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100/40 via-transparent to-emerald-50/50" />
        <div className="relative z-10 w-full max-h-full overflow-y-auto">{body}</div>
      </div>
    );
  }

  return (
    <div className="editorial-hero overflow-hidden min-h-[420px] sm:min-h-[480px] relative">
      <div className="accent-bar" />
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-[var(--surface)] to-emerald-50/80" />
      {body}
    </div>
  );
}
