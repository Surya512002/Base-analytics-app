"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Clock, Hourglass, LockOpen, type LucideIcon } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";
import type { ReactNode } from "react";

export interface WizardStepDef {
  step: number;
  title: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Step indicator: numbered/iconed dots joined by a track that fills as you advance.
 * Completed steps show a check; tapping a reachable step calls onSelect.
 */
export function WizardStepper({
  steps,
  current,
  onSelect,
  isDisabled,
}: {
  steps: WizardStepDef[];
  current: number;
  onSelect: (step: number) => void;
  isDisabled?: (step: number) => boolean;
}) {
  const reduce = useReducedMotion();
  const progress = (current - 1) / (steps.length - 1);

  return (
    <nav aria-label="Gift creation steps" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4 sm:px-6 shadow-sm">
      <div className="relative">
        {/* track */}
        <div aria-hidden className="absolute left-5 right-5 top-5 h-1 rounded-full bg-[var(--surface-2)]" />
        <motion.div
          aria-hidden
          className="absolute left-5 top-5 h-1 rounded-full bg-gradient-to-r from-[var(--brand)] to-indigo-400"
          initial={false}
          animate={{ width: `calc((100% - 2.5rem) * ${progress})` }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 22 }}
        />
        <ol className="relative flex justify-between">
          {steps.map((s) => {
            const done = current > s.step;
            const active = current === s.step;
            const disabled = isDisabled?.(s.step) ?? false;
            const Icon = s.icon;
            return (
              <li key={s.step} className="flex flex-col items-center gap-1.5 text-center">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(s.step)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${s.step}: ${s.title}`}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed ${
                    active
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/30"
                      : done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--brand)]/50"
                  }`}
                >
                  {active && !reduce && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full border-2 border-[var(--brand)]"
                      animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  {done ? <Check size={18} strokeWidth={3} /> : <Icon size={17} />}
                </button>
                <span className={`text-[11px] font-bold sm:text-xs ${active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
                  {s.title}
                </span>
                <span className="hidden max-w-[9rem] truncate text-[10px] text-[var(--ink-dim)] sm:block">{s.hint}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** Friendly header for each step: icon badge, title, one-line help. */
export function StepHeader({
  icon: Icon,
  step,
  total,
  title,
  description,
}: {
  icon: LucideIcon;
  step: number;
  total: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-indigo-500 text-white shadow-md shadow-[var(--brand)]/25">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[var(--brand-text)]">
          Step {step} of {total}
        </p>
        <h2 className="text-xl font-black leading-tight text-[var(--ink)] sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">{description}</p>
      </div>
    </div>
  );
}

/** Slides step content in from the direction of travel. */
export function StepSlide({ direction, children }: { direction: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className="space-y-5">{children}</div>;
  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, x: direction * 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -28 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Visualises the split: a fan of mini gift cards (up to 6 drawn) with "N cards × amount each".
 * Re-animates when the count changes.
 */
export function SplitVisual({ count, perCard }: { count: number; perCard: string }) {
  const reduce = useReducedMotion();
  const drawn = Math.min(count, 6);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
      <div className="relative h-14 shrink-0" style={{ width: 44 + (drawn - 1) * 10 }} aria-hidden>
        {Array.from({ length: drawn }, (_, i) => (
          <motion.div
            key={`${count}-${i}`}
            className="absolute top-0 h-14 w-11 rounded-lg border border-white/25 bg-gradient-to-br from-[var(--brand)] to-indigo-500 shadow-md"
            style={{ left: i * 10, zIndex: i }}
            initial={reduce ? false : { y: 12, opacity: 0, rotate: 0 }}
            animate={{ y: 0, opacity: 1, rotate: (i - (drawn - 1) / 2) * 5 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="absolute left-1.5 top-1.5 h-1.5 w-4 rounded-full bg-white/50" />
            <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black text-white">🎁</span>
          </motion.div>
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-[var(--ink)]">
          {count} {count === 1 ? "gift card" : "gift cards"}
          {count > 6 && <span className="font-semibold text-[var(--ink-muted)]"> (showing 6)</span>}
        </p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold truncate">{perCard} each</p>
      </div>
    </div>
  );
}

const UNLOCK_OPTIONS = [
  { value: 0, label: "Now" },
  { value: 24, label: "1 day" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
] as const;

const EXPIRY_OPTIONS = [
  { value: 0, label: "Never" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

function Segmented({
  id,
  options,
  value,
  onChange,
  label,
}: {
  id: string;
  options: ReadonlyArray<{ value: number; label: string }>;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`relative isolate rounded-lg px-1 py-2 text-xs font-bold transition-colors ${
              selected ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {selected && <ActivePill layoutId={`timing-${id}`} className="bg-[var(--brand)] shadow-sm" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const dayLabel = (hours: number) =>
  hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hours`;

/**
 * "When can they open it?" — optional unlock delay and expiry, with a mini timeline and a
 * plain-English summary. Only calls the provided setters; no logic of its own.
 */
export function TimingCard({
  unlockHours,
  onUnlock,
  expirationDays,
  onExpire,
}: {
  unlockHours: number;
  onUnlock: (h: number) => void;
  expirationDays: number;
  onExpire: (d: number) => void;
}) {
  const reduce = useReducedMotion();
  const opens = unlockHours > 0 ? `Opens in ${dayLabel(unlockHours)}` : "Can be claimed right away";
  const expires =
    expirationDays > 0
      ? `unclaimed cards come back to you after ${expirationDays} days`
      : "it never expires (you can't reclaim unclaimed cards)";

  // Timeline positions (0..100%): opens point grows with unlock; expiry sits at the end when set.
  const opensAt = unlockHours > 0 ? Math.min(55, 15 + unlockHours / 4) : 0;

  return (
    <section aria-label="When can they open it" className="rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-[var(--brand)] text-white shadow-md">
          <Clock size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-[var(--ink)]">When can they open it?</h3>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)] border border-[var(--border-subtle)]">
              Optional
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)]">Hold the gift until a date, and decide when unclaimed cards come back.</p>
        </div>
      </div>

      {/* mini timeline */}
      <div className="relative h-10 px-1" aria-hidden>
        <div className="absolute left-1 right-1 top-3 h-1 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)]" />
        <motion.div
          className="absolute top-3 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-[var(--brand)]"
          initial={false}
          animate={{ left: `${opensAt}%`, right: expirationDays > 0 ? "4%" : "1%" }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }}
        />
        <div className="absolute left-0 top-0 flex flex-col items-start">
          <span className="h-7 w-0.5 rounded bg-[var(--ink-dim)]" />
          <span className="text-[10px] font-semibold text-[var(--ink-dim)]">Today</span>
        </div>
        <motion.div
          className="absolute top-0 flex flex-col items-center -translate-x-1/2"
          initial={false}
          animate={{ left: `${Math.max(opensAt, 8)}%` }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }}
        >
          <span className="mt-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          <span className="text-[10px] font-bold text-emerald-500 whitespace-nowrap">
            {unlockHours > 0 ? "Opens" : "Open"}
          </span>
        </motion.div>
        <div className="absolute right-0 top-0 flex flex-col items-end">
          <span
            className={`mt-1.5 flex h-4 w-4 items-center justify-center rounded-full ${
              expirationDays > 0 ? "bg-amber-500 ring-4 ring-amber-500/20" : "bg-[var(--surface)] border border-[var(--border-subtle)]"
            }`}
          />
          <span className={`text-[10px] font-bold ${expirationDays > 0 ? "text-amber-500" : "text-[var(--ink-dim)]"}`}>
            {expirationDays > 0 ? "Expires" : "No expiry"}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-soft)]">
          <LockOpen size={13} className="text-emerald-500" /> Claimable from
        </p>
        <Segmented id="unlock" label="Claimable from" options={UNLOCK_OPTIONS} value={unlockHours} onChange={onUnlock} />
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-soft)]">
          <Hourglass size={13} className="text-amber-500" /> Unclaimed cards come back after
        </p>
        <Segmented id="expiry" label="Unclaimed cards come back after" options={EXPIRY_OPTIONS} value={expirationDays} onChange={onExpire} />
      </div>

      <p className="rounded-xl bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--ink-muted)] border border-[var(--border-subtle)]">
        <span className="font-bold text-[var(--ink)]">{opens}</span> · {expires}.
      </p>
    </section>
  );
}
