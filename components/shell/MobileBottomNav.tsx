"use client";

import type { AppTab } from "@/hooks/useWalletApp";
import { isRewardsHubTab } from "@/lib/utils/app-url";
import { APP_NAV } from "@/lib/nav/app-nav";

const ITEMS = APP_NAV.map((n) => ({
  id: n.id,
  icon: n.icon,
  label: n.shortLabel ?? n.label,
}));

export default function MobileBottomNav({
  tab,
  onTabChange,
  guest,
  onConnect,
}: {
  tab: AppTab;
  onTabChange: (t: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.08] bg-[#080808]/97 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto px-1">
        {ITEMS.map(({ id, icon: Icon, label }) => {
          const active = tab === id || (id === "checkin" && isRewardsHubTab(tab));
          const locked = guest && id !== "launchpad" && id !== "swap";
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-disabled={locked || undefined}
              onClick={() => (locked ? onConnect?.() : onTabChange(id))}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-0.5 transition-colors touch-manipulation ${
                active ? "text-[var(--ink)]" : "text-[var(--ink-dim)]"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[10px] font-semibold tracking-wide leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
