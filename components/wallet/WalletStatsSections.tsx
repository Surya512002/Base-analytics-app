"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { MotionItem, MotionStagger } from "@/components/ui/MotionShell";

function StatTile({
  label,
  value,
  icon,
  dim,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={`analytics-tile rounded-2xl p-3 sm:p-4 group ${dim ? "opacity-60" : ""}`}
    >
      <div className="mb-2 group-hover:scale-110 transition-transform w-fit">{icon}</div>
      <p className="font-black text-[var(--ink)] text-sm sm:text-base truncate leading-tight tabular-nums">
        {value}
      </p>
      <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold tracking-wide mt-0.5 truncate">
        {label}
      </p>
    </div>
  );
}

function StatsSection({
  title,
  defaultOpen = true,
  children,
  accentClass,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  accentClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();

  return (
    <div
      className={`rounded-2xl border bg-[var(--bg-raised)] overflow-hidden ${
        accentClass || "border-[var(--border-subtle)]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <span className="text-[12px] sm:text-[13px] font-bold text-[var(--ink)] tracking-tight">
          {title}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-[var(--ink-muted)] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[var(--ink-muted)] shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-4 sm:px-4 sm:pb-5 pt-0">
              <MotionStagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {children}
              </MotionStagger>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type WalletStatItem = {
  label: string;
  value: string | number;
  icon: ReactNode;
  dim?: boolean;
};

export default function WalletStatsSections({
  overview,
  balances,
  activity,
  trading,
  engagement,
}: {
  overview: WalletStatItem[];
  balances: WalletStatItem[];
  activity: WalletStatItem[];
  trading: WalletStatItem[];
  engagement: WalletStatItem[];
}) {
  return (
    <div className="space-y-3">
      <p className="section-eyebrow flex items-center gap-2">Wallet intelligence</p>
      <StatsSection title="Overview" defaultOpen accentClass="border-sky-200/70">
        {overview.map((s) => (
          <MotionItem key={s.label}>
            <StatTile {...s} />
          </MotionItem>
        ))}
      </StatsSection>
      <StatsSection title="Balances & portfolio" defaultOpen accentClass="border-teal-200/70">
        {balances.map((s) => (
          <MotionItem key={s.label}>
            <StatTile {...s} />
          </MotionItem>
        ))}
      </StatsSection>
      <StatsSection title="Activity & streaks" defaultOpen={false} accentClass="border-orange-200/60">
        {activity.map((s) => (
          <MotionItem key={s.label}>
            <StatTile {...s} />
          </MotionItem>
        ))}
      </StatsSection>
      <StatsSection title="Trading & DeFi" defaultOpen accentClass="border-indigo-200/70">
        {trading.map((s) => (
          <MotionItem key={s.label}>
            <StatTile {...s} />
          </MotionItem>
        ))}
      </StatsSection>
      <StatsSection title="Quests & health" defaultOpen={false} accentClass="border-rose-200/60">
        {engagement.map((s) => (
          <MotionItem key={s.label}>
            <StatTile {...s} />
          </MotionItem>
        ))}
      </StatsSection>
    </div>
  );
}
