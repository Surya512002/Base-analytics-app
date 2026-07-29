"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Command } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import CommandPalette from "@/components/shell/CommandPalette";
import MobileBottomNav from "@/components/shell/MobileBottomNav";
import { syncTabUrl } from "@/lib/utils/app-url";

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
  onTabChange: (t: AppTab) => void;
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

  const handleTabChange = (t: AppTab) => {
    if (guest && t !== "launchpad" && t !== "swap") {
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

      <div className="app-container flex w-full min-w-0 flex-1 flex-col py-5 sm:py-6 md:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10 lg:pb-10">
        <div className="mb-4 md:hidden">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink-muted)] shadow-[var(--shadow-card)]"
          >
            <Command size={14} />
            <span className="text-[13px]">Search tokens &amp; pages</span>
            <kbd className="ml-auto text-[9px] font-mono border border-[var(--border-subtle)] rounded px-1">
              ⌘K
            </kbd>
          </button>
        </div>

        {children}
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
        walletAddress={walletAddress}
      />
    </>
  );
}
