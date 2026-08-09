"use client";

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
  if (p.includes("complete") || p.includes("up to date") || p.includes("ready"))
    return 4;
  if (p.includes("heatmap") || p.includes("swap") || p.includes("volume")) return 3;
  if (p.includes("score") || p.includes("calculat")) return 2;
  if (
    p.includes("history") ||
    p.includes("alchemy") ||
    p.includes("collect") ||
    p.includes("sync") ||
    p.includes("active days")
  )
    return 1;
  if (p.includes("payment") || p.includes("confirmed")) return 0;
  return 1;
}

/**
 * Post-pay scan only — deliberately different from the locked paywall card:
 * emerald “payment confirmed” chrome, wallet-scoped copy, live stage ticks.
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
  /** Connected wallet — shown so it’s clear we only index this address. */
  walletAddress?: string;
}) {
  const activeStage = stageIndex(scanProgress);
  const pct = Math.min(94, Math.max(18, 12 + activeStage * 20));
  const short =
    walletAddress && walletAddress.length === 42
      ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
      : null;

  const body = (
    <div className="relative w-full max-w-lg mx-auto text-center px-4 py-8 sm:py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl" aria-hidden>
        {[
          { size: 110, x: "6%", y: "10%", color: "rgba(16,185,129,0.2)", delay: 0 },
          { size: 72, x: "70%", y: "20%", color: "rgba(5,150,105,0.16)", delay: 0.5 },
          { size: 88, x: "50%", y: "60%", color: "rgba(20,184,166,0.14)", delay: 0.9 },
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
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 mb-4">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
            Payment confirmed · scanning live
          </span>
        </div>

        <motion.div
          className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200 flex items-center justify-center shadow-[0_8px_28px_rgba(16,185,129,0.2)]"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          {walletRefreshing ? (
            <BarChart3 size={26} className="text-emerald-700" />
          ) : (
            <Sparkles size={26} className="text-emerald-700" />
          )}
        </motion.div>

        <h2 className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight">
          Indexing your wallet on Base
        </h2>
        <p className="text-sm text-emerald-900/70 max-w-md mx-auto leading-relaxed mt-2">
          Only activity from{" "}
          <span className="font-mono font-bold text-emerald-900">
            {short || "your connected address"}
          </span>{" "}
          — not chain-wide scans. Score tiles unlock as soon as the first pass finishes;
          deeper history may refine in the background.
        </p>

        <AnimatePresence mode="wait">
          <motion.p
            key={scanProgress || "default"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-[11px] font-bold text-emerald-800 uppercase tracking-wide"
          >
            {scanProgress || "Collecting your transfers & UserOps…"}
          </motion.p>
        </AnimatePresence>

        <div className="mt-5 max-w-md mx-auto">
          <div className="h-2.5 rounded-full bg-emerald-100 border border-emerald-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400"
              initial={{ width: "14%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />
          </div>
          <p className="mt-2 text-[11px] text-emerald-800/70 font-mono tabular-nums">
            {pct}% · your address only
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg mx-auto">
          {PAID_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const done = i < activeStage;
            const current = i === Math.min(activeStage, PAID_STAGES.length - 1) && !done
              ? true
              : i === activeStage;
            return (
              <motion.div
                key={stage.id}
                className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
                  done
                    ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : current
                      ? "bg-white border-emerald-400 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                      : "bg-emerald-50/50 border-emerald-100 text-emerald-700/50"
                }`}
                animate={current && !done ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 1.4, repeat: Infinity }}
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
        <div className="absolute inset-0 bg-emerald-50/80 backdrop-blur-md" />
        <div className="absolute inset-0 bg-gradient-to-b from-teal-100/50 via-transparent to-emerald-100/40" />
        <div className="relative z-10 w-full max-h-full overflow-y-auto">{body}</div>
      </div>
    );
  }

  return (
    <div className="editorial-hero overflow-hidden min-h-[400px] sm:min-h-[460px] relative border border-emerald-200">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80" />
      {body}
    </div>
  );
}
