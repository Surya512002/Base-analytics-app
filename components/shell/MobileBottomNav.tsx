"use client";

import Link from "next/link";
import ActivePill from "@/components/ui/motion/ActivePill";
import { usePathname } from "next/navigation";
import { CandlestickChart, Gift, Home, Menu, PieChart } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import { MY_STOCKS_HREF, STOCK_LIST_HREF } from "@/lib/constants/destinations";

interface MobileBottomNavProps {
  tab?: AppTab;
  onTabChange?: (t: AppTab) => void;
}

export default function MobileBottomNav({ tab, onTabChange }: MobileBottomNavProps) {
  const pathname = usePathname() || "";
  // Home, Vouchers and a few other screens share the "/" page and differ only by tab.
  const onRoot = pathname === "/";
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  const tabs = [
    {
      id: "home",
      label: "Home",
      href: "/",
      icon: Home,
      active: onRoot && (!tab || tab === "launchpad"),
      tabId: "launchpad" as AppTab,
    },
    {
      id: "stocks",
      label: "Stocks",
      href: STOCK_LIST_HREF,
      icon: CandlestickChart,
      active: under("/explore") || under("/trade") || (onRoot && tab === "trade"),
      tabId: undefined,
    },
    {
      id: "mystocks",
      label: "My Stocks",
      href: MY_STOCKS_HREF,
      icon: PieChart,
      active: under("/lend") || (onRoot && tab === "lend"),
      tabId: undefined,
    },
    {
      id: "vouchers",
      label: "Vouchers",
      href: "/?tab=basehub",
      icon: Gift,
      active: onRoot && tab === "basehub",
      tabId: "basehub" as AppTab,
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed inset-x-3 mx-auto max-w-xl bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] z-50 rounded-[1.6rem] border border-[var(--border-subtle)] bg-[var(--surface)]/90 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(11,21,38,0.35)]"
    >
      {/* Floating dock: the active tab gets a soft blue pill that slides between tabs */}
      <div className="flex w-full items-stretch justify-around gap-0.5 p-1.5">
        {tabs.map((item) => {
          const Icon = item.icon;

          const handleClick = () => {
            // These live on this same page, so the link alone would change the address, not the screen.
            if (onRoot && item.tabId) onTabChange?.(item.tabId);
          };

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={handleClick}
              aria-current={item.active ? "page" : undefined}
              aria-label={item.label}
              className={`relative isolate flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[50px] py-1 px-0.5 rounded-2xl transition-colors touch-manipulation select-none ${
                item.active
                  ? "text-[#0052FF] dark:text-[#3888ff] font-bold"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)] font-semibold"
              }`}
            >
              {item.active && <ActivePill layoutId="mobile-dock-pill" className="bg-[var(--brand-soft)]" />}
              <div className="relative">
                <Icon
                  size={19}
                  strokeWidth={item.active ? 2.3 : 1.8}
                  className={
                    item.active
                      ? "stroke-[#0052FF] dark:stroke-[#3888ff]"
                      : "stroke-current"
                  }
                />
              </div>
              <span className="max-w-full truncate text-[11px] sm:text-[11px] tracking-tight leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
        {/* Everything else lives in the menu; this opens it */}
        <button
          type="button"
          aria-label="More"
          onClick={() => window.dispatchEvent(new Event("open-mobile-menu"))}
          className="relative isolate flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 min-h-[50px] py-1 px-0.5 rounded-2xl text-[var(--ink-muted)] hover:text-[var(--ink)] font-semibold touch-manipulation select-none"
        >
          <Menu size={19} strokeWidth={1.8} />
          <span className="max-w-full truncate text-[11px] tracking-tight leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}
