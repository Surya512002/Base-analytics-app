"use client";

import { Gift, Link2, Ticket, Wallet, type LucideIcon } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";
import { VOUCHER_VIEW_TABS } from "@/components/voucher/voucher-constants";
import type { VoucherView } from "@/components/voucher/voucher-types";

const TAB_ICONS: Record<string, LucideIcon> = {
  create: Gift,
  redeem: Ticket,
  campaign: Link2,
  mine: Wallet,
};

export default function VoucherSegmentTabs({
  view,
  onChange,
}: {
  view: VoucherView;
  onChange: (v: VoucherView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Voucher actions"
      className="flex gap-1 glass-panel p-1 rounded-2xl overflow-x-auto no-scrollbar"
    >
      {VOUCHER_VIEW_TABS.map(([id, label]) => {
        const selected = view === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id as VoucherView)}
            className={`relative isolate flex flex-1 min-w-0 min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-xl text-[11px] font-bold transition-colors sm:min-w-[5.5rem] sm:flex-row sm:gap-2 sm:text-sm ${
              selected ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {selected && <ActivePill layoutId="voucher-view-pill" className="tab-active" />}
            {(() => {
              const Icon = TAB_ICONS[id] ?? Gift;
              return <Icon size={16} className={selected ? "text-[var(--brand-text)]" : ""} aria-hidden />;
            })()}
            {label}
          </button>
        );
      })}
    </div>
  );
}
