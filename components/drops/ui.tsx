"use client";

import React from "react";

/** Small shared building blocks for the Drops screens (same tokens as the rest of the app). */

export const btn =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary = `${btn} bg-[var(--brand)] text-white hover:opacity-90`;
export const btnSecondary = `${btn} bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40`;
export const btnDanger = `${btn} bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-500/15`;
export const inputCls =
  "w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-text)]";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm space-y-4 ${className}`}>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-[var(--ink-soft)]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[var(--ink-muted)]">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
        {hint && <span className="block text-xs text-[var(--ink-muted)]">{hint}</span>}
      </span>
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "error"
      ? "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "ok"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)]";
  return (
    <p role={tone === "error" ? "alert" : "note"} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${cls}`}>
      {children}
    </p>
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "ok" | "warn" | "bad" | "brand" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25"
        : tone === "bad"
          ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25"
          : tone === "brand"
            ? "bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--border-subtle)]"
            : "bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--border-subtle)]";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

/** "in 3h 20m" / "2d 4h" countdown text. */
export function untilText(targetSec: number, nowSec: number): string {
  const s = Math.max(0, targetSec - nowSec);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export const TRUST_LABEL: Record<string, string> = {
  onchain: "Checked onchain",
  verified: "Verified",
  account: "Account check",
  proof: "Public proof",
  answer: "Answer",
};

/** Current unix time in seconds, refreshed every `everyMs` (keeps renders pure). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
  React.useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
