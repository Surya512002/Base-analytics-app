"use client";

export type BadgeCatalogTab = "app" | "onchain";

const TABS: { id: BadgeCatalogTab; label: string; primary?: boolean }[] = [
  { id: "app", label: "App badges", primary: true },
  { id: "onchain", label: "Onchain score" },
];

export default function BadgeCatalogTabs({
  active,
  onChange,
}: {
  active: BadgeCatalogTab;
  onChange: (tab: BadgeCatalogTab) => void;
}) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar touch-scroll-x border-b border-white/[0.08] mb-5">
      <span className="text-[var(--ink-dim)] font-mono text-xs shrink-0 select-none">{"////"}</span>
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`shrink-0 filter-tab ${isActive ? "filter-tab-active" : ""} ${
              tab.primary && !isActive ? "text-white/70" : ""
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
