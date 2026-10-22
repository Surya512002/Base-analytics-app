"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ArrowLeftRight, Coins, Gift, Rocket } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

interface MobileBottomNavProps {
  tab?: AppTab;
  onTabChange?: (t: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
  walletAddress?: string | null;
}

export default function MobileBottomNav({
  tab,
  onTabChange,
  guest,
  onConnect,
}: MobileBottomNavProps) {
  const pathname = usePathname() || "";

  // Determine active states for the 5 tabs
  const isLaunch = pathname === "/launch" || pathname.startsWith("/launch");
  const isSwap =
    pathname === "/swap" ||
    pathname.startsWith("/swap") ||
    (pathname === "/" && tab === "swap");
  const isLend =
    pathname === "/lend" ||
    pathname.startsWith("/lend") ||
    pathname.startsWith("/earn") ||
    (pathname === "/" && tab === "lend");
  const isVouchers =
    pathname === "/redeem" ||
    pathname.startsWith("/redeem") ||
    (pathname === "/" && tab === "basehub");
  const isExplore =
    !isLaunch &&
    (pathname === "/explore" ||
      pathname.startsWith("/explore") ||
      ((pathname === "/" || !pathname) && (tab === "launchpad" || !tab)));

  const tabs = [
    {
      id: "explore",
      label: "Explore",
      href: "/explore",
      icon: Compass,
      active: isExplore,
      tabId: "launchpad" as AppTab,
      guestOk: true,
    },
    {
      id: "swap",
      label: "Swap",
      href: "/swap",
      icon: ArrowLeftRight,
      active: isSwap,
      tabId: "swap" as AppTab,
      guestOk: true,
    },
    {
      id: "lend",
      label: "Lend",
      href: "/lend",
      icon: Coins,
      active: isLend,
      tabId: "lend" as AppTab,
      guestOk: true,
    },
    {
      id: "vouchers",
      label: "Vouchers",
      href: "/?tab=basehub",
      icon: Gift,
      active: isVouchers,
      tabId: "basehub" as AppTab,
      guestOk: false,
    },
    {
      id: "launch",
      label: "Launch",
      href: "/launch",
      icon: Rocket,
      active: isLaunch,
      tabId: "launchpad" as AppTab,
      guestOk: false,
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 w-full border-t border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(11,21,38,0.08)]"
    >
      <div className="flex w-full items-stretch justify-around px-1 py-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          const locked = guest && !item.guestOk;

          const handleClick = (e: React.MouseEvent) => {
            if (locked) {
              e.preventDefault();
              onConnect?.();
              return;
            }
            if (
              pathname === "/" &&
              onTabChange &&
              item.tabId &&
              item.id !== "launch" &&
              item.id !== "explore"
            ) {
              onTabChange(item.tabId);
            }
          };

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={handleClick}
              aria-current={item.active ? "page" : undefined}
              aria-label={item.label}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 min-h-[48px] py-1.5 px-0.5 rounded-xl transition-all touch-manipulation select-none relative ${
                item.active
                  ? "text-[#0052FF] dark:text-[#3888ff] font-bold"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)] font-semibold"
              }`}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={item.active ? 2.3 : 1.8}
                  className={
                    item.active
                      ? "stroke-[#0052FF] dark:stroke-[#3888ff]"
                      : "stroke-current"
                  }
                />
                {item.active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0052FF] dark:bg-[#3888ff]" />
                )}
              </div>
              <span className="max-w-full truncate text-xs tracking-tight leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
