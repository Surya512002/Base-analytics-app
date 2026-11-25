"use client";

import Link from "next/link";
import ActivePill from "@/components/ui/motion/ActivePill";
import { usePathname } from "next/navigation";
import { CandlestickChart, Compass, ArrowLeftRight, Landmark, User, Menu } from "lucide-react";
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
  walletAddress,
}: MobileBottomNavProps) {
  const pathname = usePathname() || "";

  // Determine active states for the tabs
  const isProfile =
    pathname === "/profile" ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/creator");

  const isTrade =
    !isProfile &&
    (pathname === "/trade" ||
      pathname.startsWith("/trade") ||
      (pathname === "/" && tab === "trade"));

  const isSwap =
    !isProfile &&
    (pathname === "/swap" ||
      pathname.startsWith("/swap") ||
      (pathname === "/" && tab === "swap"));

  const isLend =
    !isProfile &&
    (pathname.startsWith("/lend") || pathname.startsWith("/earn") || (pathname === "/" && tab === "lend"));

  const isExplore =
    !isProfile &&
    (pathname === "/explore" ||
      pathname.startsWith("/explore") ||
      ((pathname === "/" || !pathname) && (tab === "launchpad" || !tab)));

  const profileHref = walletAddress
    ? `/creator/${walletAddress.toLowerCase()}`
    : "/profile";

  const tabs = [
    {
      id: "trade",
      label: "Trade",
      href: "/trade",
      icon: CandlestickChart,
      active: isTrade,
      tabId: "trade" as AppTab,
      guestOk: true,
    },
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
      icon: Landmark,
      active: isLend,
      tabId: "lend" as AppTab,
      guestOk: true,
    },
    {
      id: "profile",
      label: "Profile",
      href: profileHref,
      icon: User,
      active: isProfile,
      tabId: undefined,
      guestOk: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] z-50 rounded-[1.6rem] border border-[var(--border-subtle)] bg-[var(--surface)]/90 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(11,21,38,0.35)]"
    >
      {/* Floating dock: the active tab gets a soft blue pill that slides between tabs */}
      <div className="flex w-full items-stretch justify-around gap-0.5 p-1.5">
        {tabs.map((item) => {
          const Icon = item.icon;
          const locked = guest && !item.guestOk;

          const handleClick = (e: React.MouseEvent) => {
            if (item.id === "profile" && guest && !walletAddress && onConnect) {
              onConnect();
              return;
            }
            if (locked) {
              e.preventDefault();
              onConnect?.();
              return;
            }
            // Guests simply follow the link; switching tabs in place would ask them to connect.
            if (
              pathname === "/" &&
              !guest &&
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
        {/* Drops, Launch and Vouchers live in the menu; this opens it */}
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
