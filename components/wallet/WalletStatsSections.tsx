"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
    <div className={`analytics-tile rounded-2xl p-3 sm:p-4 group ${dim ? "opacity-60" : ""}`}>
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
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <span className="text-[12px] sm:text-[13px] font-bold text-[var(--ink)] tracking-tight">{title}</span>
        {open ? (
          <ChevronUp size={16} className="text-[var(--ink-muted)] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[var(--ink-muted)] shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-4 sm:px-4 sm:pb-5 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {children}
          </div>
        </div>
      )}
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
      <StatsSection title="Overview" defaultOpen>
        {overview.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </StatsSection>
      <StatsSection title="Balances & portfolio" defaultOpen>
        {balances.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </StatsSection>
      <StatsSection title="Activity & streaks" defaultOpen={false}>
        {activity.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </StatsSection>
      <StatsSection title="Trading & DeFi" defaultOpen>
        {trading.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </StatsSection>
      <StatsSection title="Quests & health" defaultOpen={false}>
        {engagement.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </StatsSection>
    </div>
  );
}
