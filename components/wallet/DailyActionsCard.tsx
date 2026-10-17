"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Flame,
  CheckCircle2,
  Zap,
  Sun,
  Moon,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Sparkles,
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
  isBoostedToday,
  isGmSentToday,
  formatActionRelativeTime,
} from "@/lib/utils/daily-actions";
import { shortAddr } from "@/lib/launchpad/format";

interface DailyActionsCardProps {
  compact?: boolean;
  onRequestConnect?: () => void;
}

export default function DailyActionsCard({
  compact = false,
  onRequestConnect,
}: DailyActionsCardProps) {
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

  const refreshTimestamps = useCallback(() => {
    if (!address) return;
    setLastCheckInTs(readLocalLastCheckInTime(address));
    setLastBoostTs(readLocalBoostTime(address));
    setLastGmTs(readLocalGmTime(address));
  }, [address]);

  useEffect(() => {
    refreshTimestamps();
  }, [address, refreshTimestamps, checkedToday]);

  // Initial and reactive contract status sync
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

  // Check current local hour to determine if GM or GN is the primary greeting
  const isNight = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 5;
  }, []);

  const handleAction = async (type: "checkin" | "boost" | "gm" | "gn") => {
    if (!isConnected) {
      onRequestConnect?.();
      return;
    }
    await doNativeTx(type);
    refreshTimestamps();
  };

  const isCheckInLoading = minting === "checkin";
  const isBoostLoading = minting === "boost";
  const isGmLoading = minting === "gm";
  const isGnLoading = minting === "gn";

  if (compact) {
    return (
      <div className="card-quiet p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame size={15} className="text-amber-500 fill-amber-500/20" />
            <span className="text-xs font-bold text-[var(--ink)]">Daily Actions</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
            {streak}d streak
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {/* Check-in */}
          <button
            type="button"
            disabled={!isConnected || checkedToday || isCheckInLoading}
            onClick={() => void handleAction("checkin")}
            className={`pop-pill py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition-all text-[11px] font-bold border cursor-pointer ${
              checkedToday
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--brand)]"
            } disabled:opacity-75`}
          >
            {isCheckInLoading ? (
              <Loader2 size={13} className="animate-spin text-[var(--brand)]" />
            ) : checkedToday ? (
              <CheckCircle2 size={13} className="text-emerald-500" />
            ) : (
              <Calendar size={13} className="text-blue-500" />
            )}
            <span className="leading-none">{checkedToday ? "Checked" : "Check In"}</span>
          </button>

          {/* Daily Boost */}
          <button
            type="button"
            disabled={!isConnected || isBoostLoading}
            onClick={() => void handleAction("boost")}
            className={`pop-pill py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition-all text-[11px] font-bold border cursor-pointer ${
              boostedToday
                ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-purple-500"
            }`}
          >
            {isBoostLoading ? (
              <Loader2 size={13} className="animate-spin text-purple-500" />
            ) : (
              <Zap size={13} className="text-purple-500" />
            )}
            <span className="leading-none">{boostedToday ? "Boosted" : "Boost"}</span>
          </button>

          {/* GM/GN */}
          <button
            type="button"
            disabled={!isConnected || isGmLoading || isGnLoading}
            onClick={() => void handleAction(isNight ? "gn" : "gm")}
            className={`pop-pill py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition-all text-[11px] font-bold border cursor-pointer ${
              gmToday
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-amber-500"
            }`}
          >
            {isGmLoading || isGnLoading ? (
              <Loader2 size={13} className="animate-spin text-amber-500" />
            ) : isNight ? (
              <Moon size={13} className="text-indigo-400" />
            ) : (
              <Sun size={13} className="text-amber-500" />
            )}
            <span className="leading-none">{isNight ? "GN" : "GM"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
      {/* Header with Streak indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <Flame size={16} className="fill-amber-500/30" />
            </span>
            <h3 className="text-base font-bold text-[var(--ink)]">Daily Onchain Actions</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Base Mainnet
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Maintain your daily onchain record and interact with verified Base smart contracts.
          </p>
        </div>

        {/* Streak Indicator */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">Current Streak</p>
            <p className="text-sm font-black font-mono text-[var(--ink)]">
              {streak} {streak === 1 ? "Day" : "Days"}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 font-black text-sm">
            🔥
          </span>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Daily Check-In */}
        <div className="pop-row rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" />
                <span className="text-xs font-bold text-[var(--ink)]">Daily Check-In</span>
              </div>
              {checkedToday && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Today
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
              Record daily onchain presence and increment your verified active streak.
            </p>
            <p className="text-[10px] text-[var(--ink-dim)] font-mono">
              Last: {formatActionRelativeTime(lastCheckInTs)}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!isConnected || checkedToday || isCheckInLoading}
              onClick={() => void handleAction("checkin")}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                checkedToday
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default"
                  : "btn-primary"
              } disabled:opacity-75`}
            >
              {isCheckInLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Checking In…</span>
                </>
              ) : checkedToday ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Checked In Today</span>
                </>
              ) : (
                <>
                  <Calendar size={14} />
                  <span>Check In</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[10px] text-[var(--ink-dim)]">
              <span>Contract</span>
              <a
                href={`https://basescan.org/address/${CHECKIN_CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-[var(--brand)] inline-flex items-center gap-0.5"
              >
                {shortAddr(CHECKIN_CONTRACT)} <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* 2. Daily Boost */}
        <div className="pop-row rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-purple-500" />
                <span className="text-xs font-bold text-[var(--ink)]">Daily Boost</span>
              </div>
              {boostedToday && (
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Boosted
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
              Interact directly with the onchain booster protocol contract on Base.
            </p>
            <p className="text-[10px] text-[var(--ink-dim)] font-mono">
              Last: {formatActionRelativeTime(lastBoostTs)}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!isConnected || isBoostLoading}
              onClick={() => void handleAction("boost")}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                boostedToday
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25"
                  : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              }`}
            >
              {isBoostLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Boosting…</span>
                </>
              ) : boostedToday ? (
                <>
                  <CheckCircle2 size={14} className="text-purple-500" />
                  <span>Boost Again</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>Daily Boost</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[10px] text-[var(--ink-dim)]">
              <span>Contract</span>
              <a
                href={`https://basescan.org/address/${BOOSTER_CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-[var(--brand)] inline-flex items-center gap-0.5"
              >
                {shortAddr(BOOSTER_CONTRACT)} <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* 3. GM / GN */}
        <div className="pop-row rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isNight ? (
                  <Moon size={16} className="text-indigo-400" />
                ) : (
                  <Sun size={16} className="text-amber-500" />
                )}
                <span className="text-xs font-bold text-[var(--ink)]">GM / GN on Base</span>
              </div>
              {gmToday && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Broadcasted
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
              Broadcast a GM or GN message onchain via the verified GM/GN contract.
            </p>
            <p className="text-[10px] text-[var(--ink-dim)] font-mono">
              Last: {formatActionRelativeTime(lastGmTs)}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isConnected || isGmLoading}
                onClick={() => void handleAction("gm")}
                className="pop-pill py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer"
              >
                {isGmLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sun size={13} className="text-amber-500" />
                )}
                <span>Send GM</span>
              </button>

              <button
                type="button"
                disabled={!isConnected || isGnLoading}
                onClick={() => void handleAction("gn")}
                className="pop-pill py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
              >
                {isGnLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Moon size={13} className="text-indigo-400" />
                )}
                <span>Send GN</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--ink-dim)]">
              <span>Contract</span>
              <a
                href={`https://basescan.org/address/${GM_GN_CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-[var(--brand)] inline-flex items-center gap-0.5"
              >
                {shortAddr(GM_GN_CONTRACT)} <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
