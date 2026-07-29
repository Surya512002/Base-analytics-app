"use client";

import Link from "next/link";
import { User } from "lucide-react";
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
  walletAddress,
}: {
  tab: AppTab;
  onTabChange: (t: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
  walletAddress?: string | null;
}) {
  const profileHref = walletAddress ? `/creator/${walletAddress}` : "/profile";

  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 w-full border-t border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(11,21,38,0.06)]"
    >
      <div className="flex w-full max-w-none items-stretch justify-around px-0.5">
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
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 px-0.5 transition-colors touch-manipulation ${
                active ? "text-[var(--brand-dark)]" : "text-[var(--ink-dim)]"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
              <span className="max-w-full truncate text-[9px] font-semibold tracking-wide leading-none">
                {label}
              </span>
            </button>
          );
        })}
        <Link
          href={guest && !walletAddress ? "#" : profileHref}
          onClick={(e) => {
            if (guest && !walletAddress) {
              e.preventDefault();
              onConnect?.();
            }
          }}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 px-0.5 text-[var(--ink-dim)] transition-colors touch-manipulation"
          aria-label="Profile"
        >
          <User size={18} strokeWidth={1.75} />
          <span className="max-w-full truncate text-[9px] font-semibold tracking-wide leading-none">
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
}
