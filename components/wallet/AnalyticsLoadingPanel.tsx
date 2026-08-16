"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  CheckCircle2,
  Flame,
  History,
  LineChart,
  Sparkles,
  User,
} from "lucide-react";

const PAID_STAGES = [
  { id: "wallet", label: "Your wallet", icon: User },
  { id: "history", label: "Your history", icon: History },
  { id: "score", label: "Score", icon: LineChart },
  { id: "heatmap", label: "Heatmap", icon: Flame },
] as const;

function stageIndex(progress?: string): number {
  if (!progress) return 1;
  const p = progress.toLowerCase();
  // Only treat as finished when the server actually stamped history complete.
  if (
    p.includes("history is ready") ||
    p.includes("full history synced") ||
    p.startsWith("ready —") ||
    p.startsWith("ready -")
  )
    return 4;
  if (p.includes("heatmap") || p.includes("swap") || p.includes("volume")) return 3;
  if (p.includes("score") || p.includes("calculat") || p.includes("finishing"))
    return 2;
  if (
    p.includes("history") ||
    p.includes("alchemy") ||
    p.includes("collect") ||
    p.includes("sync") ||
    p.includes("index") ||
    p.includes("active day") ||
    p.includes("transfer")
  )
    return 1;
  if (p.includes("payment") || p.includes("confirmed")) return 0;
  return 1;
}

/**
 * Post-pay full scan — large, always-visible card (not a thin overlay on a tall page).
 */
export default function AnalyticsLoadingPanel({
  scanProgress,
  walletRefreshing,
  variant = "hero",
  walletAddress,
}: {
  scanProgress?: string;
  walletRefreshing?: boolean;
  variant?: "hero" | "overlay";
  walletAddress?: string;
}) {
  const activeStage = stageIndex(scanProgress);
  const startedAt = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    startedAt.current = performance.now();
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt.current);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  // Keep the bar moving so a long Alchemy walk never looks idle.
  const timePct = Math.min(88, 10 + elapsedSec * 1.05);
  const stagePct = 14 + activeStage * 18;
  const done = activeStage >= 4;
  const pct = done ? 100 : Math.min(96, Math.max(stagePct, timePct));
  const short =
    walletAddress && walletAddress.length === 42
      ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
      : null;

  const body = (
    <div className="relative w-full max-w-2xl mx-auto text-center px-4 py-10 sm:py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl" aria-hidden>
        {[
          { size: 140, x: "4%", y: "8%", color: "rgba(16,185,129,0.28)", delay: 0 },
          { size: 96, x: "68%", y: "16%", color: "rgba(5,150,105,0.22)", delay: 0.5 },
          { size: 110, x: "46%", y: "58%", color: "rgba(20,184,166,0.2)", delay: 0.9 },
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
              y: [0, -12, 4, 0],
              scale: [1, 1.1, 0.97, 1],
              opacity: [0.5, 0.85, 0.6, 0.5],
            }}
            transition={{
              duration: 3.8 + i * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
              delay: orb.delay,
            }}
          />
        ))}
      </div>

      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-400 bg-emerald-100 px-4 py-1.5 mb-5 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 animate-ping opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
          </span>
          <CheckCircle2 size={16} className="text-emerald-700" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-900">
            Payment confirmed · full onchain scan
          </span>
        </div>

        <motion.div
          className="relative w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-200 to-teal-100 border-2 border-emerald-400 flex items-center justify-center shadow-[0_10px_36px_rgba(16,185,129,0.35)]"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          {walletRefreshing ? (
            <BarChart3 size={32} className="text-emerald-800" />
          ) : (
            <Sparkles size={32} className="text-emerald-800" />
          )}
        </motion.div>

        <h2 className="text-3xl sm:text-4xl font-black text-emerald-950 tracking-tight">
          Full onchain scan
        </h2>
        <p className="text-base text-emerald-900/80 max-w-lg mx-auto leading-relaxed mt-3">
          Indexing every transfer, UserOp, and swap for{" "}
          <span className="font-mono font-bold text-emerald-950">
            {short || "your connected address"}
          </span>
          . Score and volume stay hidden until this pass finishes so you don&apos;t
          see a partial result.
        </p>

        <AnimatePresence mode="wait">
          <motion.p
            key={scanProgress || "default"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 text-sm font-black text-emerald-900"
          >
            {scanProgress || "Collecting your transfers & UserOps…"}
          </motion.p>
        </AnimatePresence>

        <div className="mt-6 max-w-xl mx-auto">
          <div
            className="relative h-5 sm:h-6 rounded-full bg-emerald-100 border-2 border-emerald-400 overflow-hidden shadow-[inset_0_1px_4px_rgba(6,95,70,0.12)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Full onchain scan progress"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
              initial={{ width: "12%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
              animate={{ x: ["-40%", "220%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="mt-3 text-lg sm:text-xl font-black text-emerald-950 tabular-nums">
            {Math.round(pct)}%
            <span className="ml-2 text-sm font-bold text-emerald-800/80">
              {done ? "Scan complete" : "Scanning your wallet…"}
            </span>
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto">
          {PAID_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const doneStage = i < activeStage;
            const current = i === Math.min(activeStage, PAID_STAGES.length - 1) && !doneStage;
            return (
              <motion.div
                key={stage.id}
                className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide ${
                  doneStage
                    ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                    : current
                      ? "bg-white border-emerald-500 text-emerald-950 shadow-[0_0_0_3px_rgba(16,185,129,0.28)]"
                      : "bg-emerald-50/50 border-emerald-100 text-emerald-700/50"
                }`}
                animate={current ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Icon size={16} />
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
      <div className="absolute inset-0 z-30 flex items-start justify-center rounded-3xl overflow-y-auto">
        <div className="absolute inset-0 bg-emerald-50/92 backdrop-blur-md" />
        <div className="absolute inset-0 bg-gradient-to-b from-teal-100/60 via-transparent to-emerald-100/50" />
        <div className="relative z-10 w-full max-h-full">{body}</div>
      </div>
    );
  }

  return (
    <div
      id="analytics-full-scan"
      className="editorial-hero overflow-hidden min-h-[520px] sm:min-h-[580px] relative border-2 border-emerald-400 shadow-[0_16px_48px_rgba(16,185,129,0.18)]"
    >
      <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80" />
      {body}
    </div>
  );
}
