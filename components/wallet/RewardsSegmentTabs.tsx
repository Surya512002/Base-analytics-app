"use client";

import type { RewardsHubView } from "@/lib/utils/app-url";

const SEGMENTS: { id: RewardsHubView; label: string }[] = [
  { id: "checkin", label: "Check-in & rank" },
  { id: "stake", label: "Stake & rewards" },
];

export default function RewardsSegmentTabs({
  active,
  onChange,
}: {
  active: RewardsHubView;
  onChange: (view: RewardsHubView) => void;
}) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar touch-scroll-x border-b border-white/[0.08] pb-0.5">
      <span className="text-[var(--ink-dim)] font-mono text-xs sm:text-sm shrink-0 select-none">
        {"////"}
      </span>
      {SEGMENTS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`shrink-0 filter-tab text-sm sm:text-base min-h-[44px] touch-manipulation ${
              isActive ? "filter-tab-active" : ""
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
