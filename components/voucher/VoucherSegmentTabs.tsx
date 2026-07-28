"use client";

import { VOUCHER_VIEW_TABS } from "@/components/voucher/voucher-constants";
import type { VoucherView } from "@/components/voucher/voucher-types";

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
            className={`flex-1 min-w-[4.75rem] min-h-[44px] py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wide transition ${
              selected ? "tab-active" : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
