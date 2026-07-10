"use client";

export type TokenCatalogTab = "all" | "b20";

const SEGMENTS: { id: TokenCatalogTab; label: string }[] = [
  { id: "all", label: "All tokens" },
  { id: "b20", label: "B20 tokens" },
];

export default function ExploreSegmentTabs({
  active,
  onChange,
}: {
  active: TokenCatalogTab;
  onChange: (tab: TokenCatalogTab) => void;
}) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar touch-scroll-x border-b border-white/[0.08]">
      <span className="text-[var(--ink-dim)] font-mono text-xs shrink-0 select-none">{"////"}</span>
      {SEGMENTS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`shrink-0 filter-tab ${isActive ? "filter-tab-active" : ""}`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
