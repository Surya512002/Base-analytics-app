"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Command } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { WalletData } from "@/lib/types/wallet";
import AppSidebar from "@/components/shell/AppSidebar";
import CommandPalette from "@/components/shell/CommandPalette";
import MobileBottomNav from "@/components/shell/MobileBottomNav";

import { syncTabUrl } from "@/lib/utils/app-url";

export default function AppShell({
  tab,
  onTabChange,
  wallet,
  walletCore,
  guest,
  onConnect,
  onCreateToken,
  onOpenToken,
  tokens,
  children,
  header,
}: {
  tab: AppTab;
  onTabChange: (t: AppTab) => void;
  wallet?: WalletData | null;
  walletCore?: {
    address: string;
    balance: string;
    portfolioValueUSD: number;
    basename: string | null;
  } | null;
  guest?: boolean;
  onConnect?: () => void;
  onCreateToken?: () => void;
  onOpenToken?: (token: LaunchedToken) => void;
  tokens?: LaunchedToken[];
  children: ReactNode;
  header: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleTabChange = (t: AppTab) => {
    if (guest && t !== "launchpad") {
      onConnect?.();
      return;
    }
    onTabChange(t);
    syncTabUrl(t);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", openPalette);
    };
  }, []);

  return (
    <>
      {header}

      <div className="relative z-10 flex w-full max-w-[min(100%,100rem)] mx-auto">
        <AppSidebar
          tab={tab}
          onTabChange={handleTabChange}
          onCommandPalette={() => setPaletteOpen(true)}
          onCreateToken={guest ? onConnect : onCreateToken}
          wallet={wallet}
          walletCore={walletCore}
          guest={guest}
          onConnect={onConnect}
        />

        <div className="flex-1 min-w-0 px-3 sm:px-6 pt-3 sm:pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          {/* Mobile command trigger */}
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[var(--bg-raised)] px-3 py-2.5 text-[var(--ink-dim)]"
            >
              <Command size={14} />
              <span className="text-[13px]">Search tokens & pages</span>
              <kbd className="ml-auto text-[9px] font-mono border border-white/10 rounded px-1">⌘K</kbd>
            </button>
          </div>

          {children}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tab={tab}
        onTabChange={handleTabChange}
        tokens={tokens ?? []}
        onOpenToken={onOpenToken}
      />

      <MobileBottomNav
        tab={tab}
        onTabChange={handleTabChange}
        guest={guest}
        onConnect={onConnect}
      />
    </>
  );
}
