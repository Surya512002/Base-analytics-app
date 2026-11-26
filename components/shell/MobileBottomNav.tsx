"use client";

import Link from "next/link";
import ActivePill from "@/components/ui/motion/ActivePill";
import ActivePlace from "@/components/shell/ActivePlace";
import { ArrowLeftRight, CandlestickChart, Compass, Home, Landmark, User, type LucideIcon } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import { DOCK_NAV, PLACE_HREF, type PlaceId } from "@/lib/nav/directory";
import { useI18n } from "@/lib/i18n/context";

const ICONS: Partial<Record<PlaceId, LucideIcon>> = {
  home: Home,
  swap: ArrowLeftRight,
  trade: CandlestickChart,
  markets: Compass,
  earn: Landmark,
  account: User,
};

export default function MobileBottomNav({ tab, walletAddress }: { tab?: AppTab; walletAddress?: string | null }) {
  const { t } = useI18n();

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed inset-x-3 mx-auto max-w-xl bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] z-50 rounded-3xl border border-[var(--card-edge)] bg-[var(--surface)]/85 backdrop-blur-xl shadow-[var(--card-shadow)]"
    >
      <ActivePlace tab={tab}>
        {(place) => (
          <div className="flex w-full items-stretch gap-0 p-1.5">
            {DOCK_NAV.map((id) => {
              const Icon = ICONS[id]!;
              const active = place === id;
              return (
                <Link
                  key={id}
                  href={id === "account" && walletAddress ? `/creator/${walletAddress.toLowerCase()}` : PLACE_HREF[id]}
                  aria-current={active ? "page" : undefined}
                  className={`relative isolate flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[17px] px-0.5 py-1 font-bold transition-colors touch-manipulation select-none ${
                    active ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {active && <ActivePill layoutId="mobile-dock-pill" className="bg-[var(--brand)]" />}
                  <Icon size={19} aria-hidden strokeWidth={active ? 2.3 : 1.8} />
                  <span className="dock-label max-w-full truncate text-[13px] leading-tight">{t.nav[id]}</span>
                </Link>
              );
            })}
          </div>
        )}
      </ActivePlace>
    </nav>
  );
}
