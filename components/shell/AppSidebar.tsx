"use client";

import {
  ArrowDownToLine,
  Command,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import { isRewardsHubTab } from "@/lib/utils/app-url";
import type { WalletData } from "@/lib/types/wallet";
import { APP_NAV } from "@/lib/nav/app-nav";

const NAV = APP_NAV.map((n) => ({
  id: n.id,
  label: n.label,
  icon: n.icon,
}));

export default function AppSidebar({
  tab,
  onTabChange,
  onCommandPalette,
  onCreateToken,
  wallet,
  walletCore,
  guest,
  onConnect,
}: {
  tab: AppTab;
  onTabChange: (t: AppTab) => void;
  onCommandPalette: () => void;
  onCreateToken?: () => void;
  wallet?: WalletData | null;
  walletCore?: {
    address: string;
    balance: string;
    portfolioValueUSD: number;
    basename: string | null;
  } | null;
  guest?: boolean;
  onConnect?: () => void;
}) {
  const portfolio = walletCore ?? wallet;
  return (
    <aside className="hidden lg:flex flex-col w-[240px] xl:w-[260px] shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] border-r border-white/[0.08] bg-[#080808]/80">
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {guest ? (
          <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)] mb-2">
              Portfolio
            </p>
            <p className="font-display text-3xl font-bold text-[var(--ink)] tracking-tight">$0.00</p>
            <p className="text-[12px] text-[var(--ink-dim)] mt-1.5">Connect to see your balance</p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={onConnect}
                className="btn-primary w-full py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
              >
                Connect wallet
              </button>
              <button
                type="button"
                onClick={() => onTabChange("basehub")}
                className="w-full py-2 rounded-lg text-[12px] font-medium border border-white/[0.08] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-white/20 transition-colors"
              >
                <ArrowDownToLine size={12} className="inline mr-1.5" />
                Deposit
              </button>
            </div>
          </div>
        ) : portfolio ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={13} className="text-[var(--ink-dim)]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
                  Portfolio
                </p>
              </div>
              <p className="font-display text-3xl font-bold text-[var(--ink)] tracking-tight">
                {portfolio.portfolioValueUSD > 0
                  ? `$${portfolio.portfolioValueUSD.toFixed(2)}`
                  : parseFloat(portfolio.balance || "0") > 0
                    ? `${parseFloat(portfolio.balance).toFixed(4)} ETH`
                    : "$0.00"}
              </p>
              <p className="text-[11px] text-[var(--ink-dim)] mt-1 font-mono truncate">
                {portfolio.address.slice(0, 6)}…{portfolio.address.slice(-4)}
              </p>
              <button
                type="button"
                onClick={() => onTabChange("basehub")}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium border border-white/[0.08] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-white/20 transition-colors"
              >
                <ArrowDownToLine size={13} />
                Deposit
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onCommandPalette}
          className="w-full flex items-center gap-2 rounded-lg border border-white/[0.08] bg-transparent px-3 py-2.5 text-left text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-white/20 transition-colors"
        >
          <Search size={14} />
          <span className="text-[13px] flex-1">Search…</span>
          <kbd className="text-[9px] font-mono border border-white/10 rounded px-1 py-0.5 flex items-center gap-0.5">
            <Command size={9} />K
          </kbd>
        </button>

        <nav className="space-y-0.5">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-dim)] mb-2">
            Browse
          </p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id || (item.id === "checkin" && isRewardsHubTab(tab));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "bg-white text-[#080808]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[13px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/[0.08]">
        <button
          type="button"
          onClick={onCreateToken}
          disabled={guest}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-semibold text-white bg-[var(--base-blue)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
        >
          <Plus size={16} />
          Launch token
        </button>
      </div>
    </aside>
  );
}
