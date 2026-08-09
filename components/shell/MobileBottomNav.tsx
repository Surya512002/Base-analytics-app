"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { User } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import { isRewardsHubTab } from "@/lib/utils/app-url";
import { APP_NAV } from "@/lib/nav/app-nav";
import { SECTION_THEME, accentForTab } from "@/lib/motion/presets";

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
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const profileHref = walletAddress ? `/creator/${walletAddress}` : "/profile";
  const profileActive =
    pathname.startsWith("/profile") || pathname.startsWith("/creator");

  return (
    <nav
      aria-label="Main navigation"
      className="mobile-nav-shell lg:hidden fixed bottom-0 inset-x-0 z-50 w-full pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex w-full max-w-none items-stretch justify-around px-0.5">
        {ITEMS.map(({ id, icon: Icon, label }) => {
          const active = tab === id || (id === "checkin" && isRewardsHubTab(tab));
          const locked = guest && id !== "launchpad" && id !== "swap";
          const theme = SECTION_THEME[accentForTab(id)];
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-disabled={locked || undefined}
              onClick={() => (locked ? onConnect?.() : onTabChange(id))}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 px-0.5 transition-colors touch-manipulation ${
                active ? "" : "text-[var(--ink-dim)]"
              }`}
              style={active ? { color: theme.accent } : undefined}
            >
              {active && !reduce && (
                <motion.span
                  layoutId="mobile-nav-dot"
                  className="absolute top-1 h-0.5 w-6 rounded-full"
                  style={{ background: theme.accent }}
                  transition={{ type: "spring", stiffness: 460, damping: 30 }}
                />
              )}
              <motion.span
                animate={
                  active && !reduce ? { y: [0, -1.5, 0], scale: [1, 1.06, 1] } : {}
                }
                transition={{ duration: 0.45 }}
              >
                <Icon size={18} strokeWidth={active ? 2.35 : 1.75} />
              </motion.span>
              <span className="max-w-full truncate text-[9px] font-semibold tracking-wide leading-none">
                {label}
              </span>
            </button>
          );
        })}
        {guest && !walletAddress ? (
          <button
            type="button"
            onClick={() => onConnect?.()}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 px-0.5 text-[var(--ink-dim)] transition-colors touch-manipulation"
            aria-label="Profile"
          >
            <User size={18} strokeWidth={1.75} />
            <span className="max-w-full truncate text-[9px] font-semibold tracking-wide leading-none">
              Profile
            </span>
          </button>
        ) : (
          <Link
            href={profileHref}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 px-0.5 transition-colors touch-manipulation ${
              profileActive ? "text-[var(--brand-dark)]" : "text-[var(--ink-dim)]"
            }`}
            aria-label="Profile"
            aria-current={profileActive ? "page" : undefined}
          >
            <User size={18} strokeWidth={profileActive ? 2.25 : 1.75} />
            <span className="max-w-full truncate text-[9px] font-semibold tracking-wide leading-none">
              Profile
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}
