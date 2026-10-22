"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Flame,
  CheckCircle2,
  Calendar,
  Zap,
  Sun,
  Moon,
  Loader2,
  ExternalLink,
  Info,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useWalletApp } from "@/hooks/useWalletApp";
import { CHECKIN_CONTRACT, BOOSTER_CONTRACT, GM_GN_CONTRACT } from "@/lib/constants/contracts";
import {
  readLocalLastCheckInTime,
  readLocalCheckInToday,
} from "@/lib/utils/check-in-status";
import {
  readLocalBoostTime,
  readLocalGmTime,
  readLocalGnTime,
  isBoostedToday,
  isGmSentToday,
  isGnSentToday,
  formatActionRelativeTime,
} from "@/lib/utils/daily-actions";
import { msUntilNextUtcDay } from "@/lib/utils/calendar-rollover";

interface DailyActionConfig {
  id: "checkin" | "boost" | "gm" | "gn";
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  contract: `0x${string}`;
}

export default function DailyActionsPanel({
  onRequestConnect,
}: {
  onRequestConnect?: () => void;
}) {
  const app = useWalletApp();
  const {
    wallet,
    checkedToday,
    streak,
    minting,
    doNativeTx,
    syncCheckInStatus,
  } = app;

  const address = wallet?.address ?? "";
  const isConnected = !!wallet?.address;

  const [lastCheckInTs, setLastCheckInTs] = useState<number | null>(null);
  const [lastBoostTs, setLastBoostTs] = useState<number | null>(null);
  const [lastGmTs, setLastGmTs] = useState<number | null>(null);
  const [lastGnTs, setLastGnTs] = useState<number | null>(null);

  // Reset countdown
  const [resetCountdown, setResetCountdown] = useState<string>("");

  // Per-action tx error / success state
  const [actionTxState, setActionTxState] = useState<
    Record<string, { status: "idle" | "confirming" | "pending" | "success" | "error"; txHash?: string; error?: string }>
  >({});

  // Countdown timer calculation
  useEffect(() => {
    const updateCountdown = () => {
      const ms = msUntilNextUtcDay();
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      setResetCountdown(`${hours}h ${mins}m`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const refreshTimestamps = useCallback(() => {
    if (!address) return;
    setLastCheckInTs(readLocalLastCheckInTime(address));
    setLastBoostTs(readLocalBoostTime(address));
    setLastGmTs(readLocalGmTime(address));
    setLastGnTs(readLocalGnTime(address));
  }, [address]);

  useEffect(() => {
    refreshTimestamps();
  }, [address, refreshTimestamps, checkedToday]);

  useEffect(() => {
    if (!address || !syncCheckInStatus) return;
    void syncCheckInStatus(address).then((res) => {
      if (res.lastCheckIn) {
        setLastCheckInTs(res.lastCheckIn);
      }
    });
  }, [address, syncCheckInStatus]);

  const boostedToday = useMemo(() => {
    return isConnected ? isBoostedToday(address) : false;
  }, [isConnected, address, minting, lastBoostTs]);

  const gmToday = useMemo(() => {
    return isConnected ? isGmSentToday(address) : false;
  }, [isConnected, address, minting, lastGmTs]);

  const gnToday = useMemo(() => {
    return isConnected ? isGnSentToday(address) : false;
  }, [isConnected, address, minting, lastGnTs]);

  // Action definitions array config with Check-In, Boost, Daily GM, and Daily GN
  const ACTIONS_CONFIG: DailyActionConfig[] = [
    {
      id: "checkin",
      title: "Daily Check-In",
      description: "Verify daily onchain presence and maintain your active streak.",
      icon: Calendar,
      contract: CHECKIN_CONTRACT as `0x${string}`,
    },
    {
      id: "boost",
      title: "Daily Boost",
      description: "Trigger the onchain booster protocol on Base mainnet.",
      icon: Zap,
      contract: BOOSTER_CONTRACT as `0x${string}`,
    },
    {
      id: "gm",
      title: "Daily GM",
      description: "Broadcast your daily morning GM greeting on Base.",
      icon: Sun,
      contract: GM_GN_CONTRACT as `0x${string}`,
    },
    {
      id: "gn",
      title: "Daily GN",
      description: "Broadcast your daily evening GN greeting on Base.",
      icon: Moon,
      contract: GM_GN_CONTRACT as `0x${string}`,
    },
  ];

  const handleExecute = async (actionId: "checkin" | "boost" | "gm" | "gn") => {
    if (!isConnected) {
      onRequestConnect?.();
      return;
    }

    setActionTxState((prev) => ({
      ...prev,
      [actionId]: { status: "confirming" },
    }));

    try {
      await doNativeTx(actionId);
      refreshTimestamps();
      setActionTxState((prev) => ({
        ...prev,
        [actionId]: { status: "success" },
      }));
      setTimeout(() => {
        setActionTxState((prev) => ({
          ...prev,
          [actionId]: { status: "idle" },
        }));
      }, 4000);
    } catch (e) {
      setActionTxState((prev) => ({
        ...prev,
        [actionId]: {
          status: "error",
          error: e instanceof Error ? e.message : "Failed",
        },
      }));
    }
  };

  // 7-day dot completion
  // Show past 7 days with current streak representation
  const sevenDayDots = useMemo(() => {
    const dots: boolean[] = [];
    // If checked in today, current day is done
    for (let i = 6; i >= 0; i--) {
      if (i === 0) {
        dots.unshift(checkedToday);
      } else {
        dots.unshift(streak > i);
      }
    }
    return dots;
  }, [checkedToday, streak]);

  // Milestone hint
  const milestoneHint = useMemo(() => {
    if (streak < 7) {
      return `${7 - streak} days to 7-Day Badge`;
    }
    if (streak < 14) {
      return `${14 - streak} days to 14-Day Badge`;
    }
    if (streak < 30) {
      return `${30 - streak} days to 30-Day Master`;
    }
    return "Streak Master 🏆";
  }, [streak]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-5 w-full min-w-0 overflow-hidden">
      {/* Header: Title "Daily" & Big Streak */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)]">
              <Flame size={18} />
            </span>
            <h2 className="text-lg font-black text-[var(--ink)]">Daily</h2>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Maintain your verified onchain streak on Base.
          </p>
        </div>

        {/* Big Streak Stat */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 font-mono font-black text-2xl text-[var(--ink)] tabular-nums">
            <span>{streak}</span>
            <span className="text-amber-500 text-lg">🔥</span>
          </div>
          <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">
            {streak === 1 ? "Day streak" : "Days streak"}
          </p>
        </div>
      </div>

      {/* 7-Day Dot Row & Milestone Hint */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--ink)]">7-Day Record</span>
          <span className="text-[11px] font-bold text-[var(--brand-text)]">{milestoneHint}</span>
        </div>

        {/* 7 Dots */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {sevenDayDots.map((isDone, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1 flex-1">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : idx === 6
                      ? "border-2 border-dashed border-[var(--brand)]/50 bg-transparent"
                      : "bg-[var(--border-subtle)]/60"
                }`}
              >
                {isDone && <CheckCircle2 size={10} />}
              </span>
              <span className="text-[9px] font-bold text-[var(--ink-dim)]">
                D{idx + 1}
              </span>
            </div>
          ))}
        </div>

        {/* Reset Countdown */}
        {resetCountdown && (
          <div className="pt-2 border-t border-[var(--border-subtle)]/40 flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span className="flex items-center gap-1">
              <Clock size={12} /> Next reset:
            </span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              in {resetCountdown}
            </span>
          </div>
        )}
      </div>

      {/* 4 Uniform Action Rows (All in Base Blue System) */}
      <div className="space-y-3">
        {ACTIONS_CONFIG.map((action) => {
          const Icon = action.icon;
          const isDone =
            action.id === "checkin"
              ? checkedToday
              : action.id === "boost"
                ? boostedToday
                : action.id === "gm"
                  ? gmToday
                  : gnToday;

          const lastTs =
            action.id === "checkin"
              ? lastCheckInTs
              : action.id === "boost"
                ? lastBoostTs
                : action.id === "gm"
                  ? lastGmTs
                  : lastGnTs;

          const isLoading = minting === action.id;
          const currentTx = actionTxState[action.id]?.status ?? "idle";

          return (
            <div
              key={action.id}
              className="pop-row p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-2.5 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--ink)] truncate">
                        {action.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          isDone
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                        }`}
                      >
                        {isDone ? "Done today" : "Available"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-muted)] leading-relaxed mt-0.5">
                      {action.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button & Metadata */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-[var(--ink-muted)] font-medium">
                  Last: <span className="text-[var(--ink)] font-bold">{formatActionRelativeTime(lastTs)}</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Contract Popover / Link */}
                  <a
                    href={`https://basescan.org/address/${action.contract}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pop-pill p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--surface)] transition cursor-pointer"
                    title="View contract on Basescan"
                    aria-label="View contract on Basescan"
                  >
                    <ExternalLink size={14} />
                  </a>

                  {/* Primary Base Blue Button */}
                  <button
                    type="button"
                    disabled={!isConnected || (isDone && action.id === "checkin") || isLoading}
                    onClick={() => void handleExecute(action.id)}
                    className={`pop-pill px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isDone
                        ? "bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)] hover:text-[var(--ink)]"
                        : "bg-[#0052FF] text-white hover:bg-[#0047e0] shadow-xs active:scale-[0.98]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Sending…</span>
                      </>
                    ) : isDone ? (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span>{action.id === "checkin" ? "Done" : "Again"}</span>
                      </>
                    ) : (
                      <span>Complete</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Transaction Feedback banner if error */}
              {currentTx === "error" && (
                <div className="flex items-center justify-between text-xs text-red-500 font-bold pt-1">
                  <span>Transaction failed.</span>
                  <button
                    type="button"
                    onClick={() => void handleExecute(action.id)}
                    className="underline text-xs flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Retry
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
