"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Command } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { RewardsHubView } from "@/lib/utils/app-url";
import CommandPalette from "@/components/shell/CommandPalette";
import MobileBottomNav from "@/components/shell/MobileBottomNav";

export default function AppShell({
  tab,
  onTabChange,
  guest,
  onConnect,
  onOpenToken,
  tokens,
  children,
  header,
  walletAddress,
}: {
  tab: AppTab;
  onTabChange: (t: AppTab, opts?: { rewardsView?: RewardsHubView; token?: string | null }) => void;
  guest?: boolean;
  onConnect?: () => void;
  onCreateToken?: () => void;
  onOpenToken?: (token: LaunchedToken) => void;
  tokens?: LaunchedToken[];
  children: ReactNode;
  header: ReactNode;
  walletAddress?: string | null;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleTabChange = (
    t: AppTab,
    opts?: { rewardsView?: RewardsHubView; token?: string | null }
  ) => {
    if (guest && t !== "launchpad" && t !== "swap") {
      onConnect?.();
      return;
    }
    // Parent owns URL sync (must preserve deep-link token).
    onTabChange(t, opts);
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
    <div className="app-shell-root flex min-h-dvh w-full min-w-0 flex-col">
      {header}

      <div className="app-container flex w-full min-w-0 flex-1 flex-col py-5 sm:py-6 md:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10 lg:pb-10">
        <div className="mb-4 md:hidden section-stage">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/90 px-3 py-2.5 text-[var(--ink-muted)] shadow-[var(--shadow-card)] backdrop-blur-md transition hover:border-[var(--brand)]/30"
          >
            <Command size={14} />
            <span className="text-[13px]">Search tokens &amp; pages</span>
            <kbd className="ml-auto text-[9px] font-mono border border-[var(--border-subtle)] rounded px-1">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="section-stage min-w-0 flex-1">{children}</div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tab={tab}
        onTabChange={handleTabChange}
        tokens={tokens ?? []}
        onOpenToken={onOpenToken}
        guest={guest}
      />

      <MobileBottomNav
        tab={tab}
        onTabChange={(t) => handleTabChange(t)}
        guest={guest}
        onConnect={onConnect}
        walletAddress={walletAddress}
      />
    </div>
  );
}
