"use client";

import React from "react";
import { Check, Minus, Plus } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";

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

/** Segmented single choice with a sliding pill (same feel as the voucher timing picker). */
export function Segmented<T extends string | number>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`relative isolate min-h-[40px] rounded-lg px-1 text-xs font-bold transition-colors ${
              selected ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {selected && <ActivePill layoutId={`drops-seg-${id}`} className="bg-[var(--brand)] shadow-sm" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A selectable card with an icon. When `selected`, its `children` (the settings that belong to
 * this choice) open right underneath, so picking something always shows what to fill in next.
 */
export function OptionCard({
  icon,
  title,
  note,
  selected,
  onSelect,
  badge,
  children,
  multi,
}: {
  icon: React.ReactNode;
  title: string;
  note?: string;
  selected: boolean;
  onSelect: () => void;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  /** Shows a checkbox instead of a radio dot. */
  multi?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-colors ${
        selected ? "border-[var(--brand)] bg-[var(--brand-soft)]/40 shadow-sm" : "border-[var(--border-subtle)] bg-[var(--surface-2)]/60 hover:border-[var(--brand)]/40"
      }`}
    >
      <button
        type="button"
        role={multi ? "checkbox" : "radio"}
        aria-checked={selected}
        onClick={onSelect}
        className="flex w-full min-h-[56px] cursor-pointer items-center gap-3 p-3.5 text-left"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            selected ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--brand-text)] shadow-sm"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-black text-[var(--ink)]">
            {title} {badge}
          </span>
          {note && <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">{note}</span>}
        </span>
        <span
          aria-hidden
          className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${multi ? "rounded-md" : "rounded-full"} ${
            selected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-strong,var(--border-subtle))]"
          }`}
        >
          {selected && <Check size={12} strokeWidth={3.5} />}
        </span>
      </button>
      {selected && children && <div className="space-y-3 border-t border-[var(--border-subtle)] p-3.5">{children}</div>}
    </div>
  );
}

/** A small titled block inside a step. */
export function Section({ title, hint, children, aside }: { title: string; hint?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--ink)]">{title}</p>
          {hint && <p className="text-xs text-[var(--ink-muted)]">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** −/+ number stepper with a typed value. */
export function Stepper({ value, onChange, min = 0, max = 100_000, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label={`Fewer ${label}`} className={`${btnSecondary} w-11 px-0`} onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>
        <Minus size={16} />
      </button>
      <input
        aria-label={label}
        className="min-h-[44px] w-24 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-center text-base font-black text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, "")) || 0))}
      />
      <button type="button" aria-label={`More ${label}`} className={`${btnSecondary} w-11 px-0`} onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Quick-pick chips ("0.001", "10", "Once a day"…). */
export function Chips<T extends string | number>({ options, value, onPick }: { options: ReadonlyArray<{ value: T; label: string }>; value: T | null; onPick: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onPick(o.value)}
          className={`min-h-[34px] rounded-full border px-3 text-xs font-bold transition ${
            value === o.value
              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
              : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--ink)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
