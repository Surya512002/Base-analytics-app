"use client";

import { Bell, Pin, Rocket, X } from "lucide-react";
import { useBaseAppPin } from "@/hooks/useBaseAppPin";

export default function BaseAppPinBanner({
  walletAddress,
  onToast,
}: {
  walletAddress?: string | null;
  onToast?: (msg: string) => void;
}) {
  const { checked, showBanner, pinning, appPinned, notificationsEnabled, pinApp, dismiss } =
    useBaseAppPin(walletAddress);

  if (!checked || !showBanner || (appPinned && notificationsEnabled)) return null;

  const handlePin = () => {
    void pinApp().then((r) => {
      if (r.ok) {
        onToast?.(
          r.notificationsEnabled
            ? "Pinned — you'll get B20 & quest updates in Base App"
            : "App pinned — enable notifications in Base App settings for alerts"
        );
      } else if (r.reason === "rejected") {
        onToast?.("Pin cancelled — you can pin anytime from the banner");
      } else if (r.reason === "invalid_manifest") {
        onToast?.("Could not pin — open from base-analytics-app.vercel.app in Base App");
      }
    });
  };

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <Pin size={18} className="text-[var(--ink-muted)]" />
          </div>
          <div className="min-w-0">
            <p className="section-eyebrow text-[var(--ink-muted)] mb-1">Base App</p>
            <h3 className="text-sm font-bold text-white leading-snug">
              Pin Base Analytics for B20 launch alerts
            </h3>
            <p className="text-[12px] text-[var(--ink-muted)] mt-1 leading-relaxed">
              Save the app to your Base App home screen and turn on notifications — get
              updates when B20 tokens launch, trending rails move, and leaderboard refreshes.
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-[var(--ink-dim)]">
              <li className="flex items-center gap-1.5">
                <Rocket size={11} className="text-emerald-400 shrink-0" /> Launch &amp; trade
                B20 in-app
              </li>
              <li className="flex items-center gap-1.5">
                <Bell size={11} className="text-amber-300 shrink-0" /> B20 hype &amp; quest
                pings (opt-in)
              </li>
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePin}
            disabled={pinning}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] text-[12px] font-bold hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
          >
            {pinning ? "Opening…" : appPinned ? "Enable alerts" : "Pin app"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="p-2 rounded-lg text-[var(--ink-dim)] hover:text-white hover:bg-white/5"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
