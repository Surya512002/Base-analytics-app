"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Bell,
  BellRing,
  ArrowRight,
  TrendingDown,
  PlusCircle,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import {
  computeLiquidationStatus,
  simulateCollateralDrop,
} from "@/lib/lending/liquidation-math";
import {
  HEALTH_THRESHOLDS,
  type UserProtocolPosition,
} from "@/lib/lending/user-positions";

interface LiquidationGuardBannerProps {
  positions: UserProtocolPosition[];
  onOpenAction?: (
    marketId: string,
    action: "supply" | "withdraw" | "borrow" | "repay" | "stake" | "unstake"
  ) => void;
  onShowToast?: (title: string, desc?: string) => void;
  className?: string;
}

export default function LiquidationGuardBanner({
  positions,
  onOpenAction,
  onShowToast,
  className = "",
}: LiquidationGuardBannerProps) {
  const [simulatedDrop, setSimulatedDrop] = useState<number>(0);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [_notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");

  // Read notification state
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
    const saved = localStorage.getItem("base_liquidation_alert_enabled");
    if (saved === "true" && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const totalCollateralUsd = positions.reduce((acc, p) => acc + p.suppliedUsd, 0);
  const totalDebtUsd = positions.reduce((acc, p) => acc + p.borrowedUsd, 0);

  // Find lowest health factor among debt positions
  const debtPositions = positions.filter((p) => p.borrowedUsd > 0 && p.healthFactor !== null);
  const lowestHF =
    debtPositions.length > 0
      ? Math.min(...debtPositions.map((p) => p.healthFactor!))
      : null;

  const primaryDebtPosition = debtPositions[0];

  const status = computeLiquidationStatus({
    healthFactor: lowestHF,
    totalCollateralUsd,
    totalDebtUsd,
  });

  const effectiveBaseHF = status.healthFactor ?? 1.5;
  const simulatedHF = simulateCollateralDrop(effectiveBaseHF, simulatedDrop);

  const handleToggleNotification = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      onShowToast?.("Browser notifications unsupported", "Notifications are not supported in this browser environment.");
      return;
    }

    if (Notification.permission === "granted") {
      const next = !notificationsEnabled;
      setNotificationsEnabled(next);
      localStorage.setItem("base_liquidation_alert_enabled", next ? "true" : "false");
      onShowToast?.(
        next ? "Browser alerts enabled" : "Browser alerts disabled",
        next ? `You'll be alerted when Health Factor falls below ${HEALTH_THRESHOLDS.WATCH}.` : "Alerts muted."
      );
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        setNotificationsEnabled(true);
        localStorage.setItem("base_liquidation_alert_enabled", "true");
        onShowToast?.("Browser alerts enabled", `We'll warn you if your Health Factor falls below ${HEALTH_THRESHOLDS.WATCH}.`);
        new Notification("Base Terminal Liquidation Guard", {
          body: `Liquidation alerts enabled. We'll warn you if your Health Factor falls below ${HEALTH_THRESHOLDS.WATCH}.`,
          icon: "/favicon.ico",
        });
      } else {
        onShowToast?.("Permission denied", "Browser desktop notifications were blocked.");
      }
    } catch {
      onShowToast?.("Notification request failed", "Could not request browser notification permission.");
    }
  };

  // If user has no active debt, only show a compact reassurance bar or nothing
  const hasDebt = totalDebtUsd > 0 && lowestHF !== null;
  const isCritical = hasDebt && lowestHF < HEALTH_THRESHOLDS.WATCH;
  const isCaution = hasDebt && lowestHF >= HEALTH_THRESHOLDS.WATCH && lowestHF < HEALTH_THRESHOLDS.SAFE;

  if (!FEATURES.LIQUIDATION_GUARD) {
    return null;
  }

  return (
    <div
      data-testid="liquidation-guard-container"
      className={`rounded-2xl border transition-all ${
        isCritical
          ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-[var(--surface)] to-rose-950/20 shadow-lg shadow-rose-950/10"
          : isCaution
            ? "border-amber-500/40 bg-gradient-to-r from-amber-950/15 via-[var(--surface)] to-amber-950/15"
            : "border-[var(--border-subtle)] bg-[var(--surface-2)]/60"
      } p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Status Icon and Metric */}
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isCritical
                ? "bg-rose-500/15 text-rose-500 dark:text-rose-400 animate-pulse"
                : isCaution
                  ? "bg-amber-500/15 text-amber-500 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
            }`}
          >
            {isCritical ? (
              <ShieldAlert size={22} />
            ) : isCaution ? (
              <AlertTriangle size={22} />
            ) : (
              <ShieldCheck size={22} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">
                Liquidation Guard
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                  isCritical
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                    : isCaution
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {status.statusLabel}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              {hasDebt ? (
                <>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    Health Factor:{" "}
                    <span className="font-mono font-black text-base">
                      {lowestHF.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--ink-muted)]">
                    (Liquidation buffer:{" "}
                    <strong className="text-[var(--ink)]">
                      {status.distancePct.toFixed(1)}%
                    </strong>{" "}
                    or ~${status.bufferUsd.toLocaleString()})
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-[var(--ink)]">
                  Zero Debt · Collateral Safe
                  <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
                    (No active liquidation risk)
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions and Simulator Toggle */}
        <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-xs font-bold text-[var(--ink)] hover:border-[var(--brand)] transition cursor-pointer"
          >
            <Sliders size={13} className="text-[var(--brand-text)]" />
            <span>{showSimulator ? "Hide What-If" : "Simulate Drop"}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleNotification}
            title="Toggle browser desktop notifications when Health Factor drops"
            className={`pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
              notificationsEnabled
                ? "bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]"
                : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {notificationsEnabled ? (
              <BellRing size={13} className="text-[var(--brand-text)]" />
            ) : (
              <Bell size={13} />
            )}
            <span>{notificationsEnabled ? "Browser Alerts On" : "Browser Alerts"}</span>
          </button>

          {isCritical && primaryDebtPosition && onOpenAction && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onOpenAction(primaryDebtPosition.marketId, "supply")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs cursor-pointer transition"
              >
                <PlusCircle size={13} />
                <span>Add Collateral</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAction(primaryDebtPosition.marketId, "repay")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--brand)] hover:opacity-90 text-white text-xs font-black shadow-xs cursor-pointer transition"
              >
                <span>Repay Debt</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations Banner if at risk */}
      {isCritical && status.recommendedSupplyUsd > 0 && (
        <div className="mt-3.5 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-rose-500 shrink-0" />
            <span>
              <strong>Action Needed:</strong> Supply at least{" "}
              <strong>${status.recommendedSupplyUsd.toLocaleString()}</strong> collateral or repay{" "}
              <strong>${status.recommendedRepayUsd.toLocaleString()}</strong> debt to restore health to safe (1.50).
            </span>
          </div>
        </div>
      )}

      {/* What-If Simulator Panel */}
      {showSimulator && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Sliders size={13} className="text-[var(--brand-text)]" />
              What-If Stress Test (Simulate Collateral Market Crash)
            </span>
            <span className="text-xs font-mono font-black text-rose-600 dark:text-rose-400">
              -{simulatedDrop}% Drop
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-[var(--ink-muted)]">0%</span>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={simulatedDrop}
              onChange={(e) => setSimulatedDrop(Number(e.target.value))}
              className="w-full accent-[var(--brand)] cursor-pointer h-1.5 bg-[var(--border-subtle)] rounded-lg"
              aria-label="Simulate Collateral Drop Percentage"
            />
            <span className="text-[11px] font-mono text-[var(--ink-muted)]">-50%</span>
          </div>

          {hasDebt && lowestHF !== null ? (
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs flex-wrap">
              <div>
                <span className="text-[var(--ink-muted)]">Projected Health Factor: </span>
                <strong
                  className={`font-mono text-sm ${
                    simulatedHF !== null && simulatedHF <= 1.05
                      ? "text-rose-500"
                      : simulatedHF !== null && simulatedHF < HEALTH_THRESHOLDS.WATCH
                        ? "text-amber-500"
                        : "text-emerald-500"
                  }`}
                >
                  {simulatedHF?.toFixed(2)}
                </strong>
              </div>

              <div className="text-[var(--ink-muted)]">
                {simulatedHF !== null && simulatedHF <= 1.0 ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                    <AlertTriangle size={13} />
                    Position would be liquidated at this drop level!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={13} />
                    Safe from liquidation at -{simulatedDrop}% drop
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-xs text-[var(--ink-muted)]">
              No active debt positions to simulate. Supply stock collateral and borrow USDC to track your real Health Factor and liquidation buffer.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
